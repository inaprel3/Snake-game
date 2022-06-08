var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    /* src\BodySnake.svelte generated by Svelte v3.22.2 */

    function create_if_block(ctx) {
    	let div0;
    	let t;
    	let div1;

    	return {
    		c() {
    			div0 = element("div");
    			t = space();
    			div1 = element("div");
    			attr(div0, "id", "rightEye");
    			attr(div0, "class", "eyes svelte-15rl3i6");
    			attr(div1, "id", "leftEye");
    			attr(div1, "class", "eyes svelte-15rl3i6");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t, anchor);
    			insert(target, div1, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t);
    			if (detaching) detach(div1);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;
    	let div_class_value;
    	let if_block = /*isHead*/ ctx[1] && create_if_block();

    	return {
    		c() {
    			div = element("div");
    			if (if_block) if_block.c();
    			set_style(div, "left", /*left*/ ctx[3] + "px");
    			set_style(div, "top", /*top*/ ctx[2] + "px");
    			attr(div, "class", div_class_value = "body-snake " + /*direction*/ ctx[0] + " svelte-15rl3i6");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    		},
    		p(ctx, [dirty]) {
    			if (/*isHead*/ ctx[1]) {
    				if (if_block) ; else {
    					if_block = create_if_block();
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*left*/ 8) {
    				set_style(div, "left", /*left*/ ctx[3] + "px");
    			}

    			if (dirty & /*top*/ 4) {
    				set_style(div, "top", /*top*/ ctx[2] + "px");
    			}

    			if (dirty & /*direction*/ 1 && div_class_value !== (div_class_value = "body-snake " + /*direction*/ ctx[0] + " svelte-15rl3i6")) {
    				attr(div, "class", div_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block) if_block.d();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { direction = "right" } = $$props;
    	let { isHead = false } = $$props;
    	let { top = 50 } = $$props;
    	let { left = 50 } = $$props;

    	$$self.$set = $$props => {
    		if ("direction" in $$props) $$invalidate(0, direction = $$props.direction);
    		if ("isHead" in $$props) $$invalidate(1, isHead = $$props.isHead);
    		if ("top" in $$props) $$invalidate(2, top = $$props.top);
    		if ("left" in $$props) $$invalidate(3, left = $$props.left);
    	};

    	return [direction, isHead, top, left];
    }

    class BodySnake extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { direction: 0, isHead: 1, top: 2, left: 3 });
    	}
    }

    /* src\Snake.svelte generated by Svelte v3.22.2 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	child_ctx[4] = i;
    	return child_ctx;
    }

    // (6:0) {#each bodiesSnake as bodySnake, i}
    function create_each_block(ctx) {
    	let current;

    	const bodysnake = new BodySnake({
    			props: {
    				isHead: /*i*/ ctx[4] == 0,
    				top: /*bodySnake*/ ctx[2].top,
    				left: /*bodySnake*/ ctx[2].left,
    				direction: /*direction*/ ctx[0]
    			}
    		});

    	return {
    		c() {
    			create_component(bodysnake.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(bodysnake, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const bodysnake_changes = {};
    			if (dirty & /*bodiesSnake*/ 2) bodysnake_changes.top = /*bodySnake*/ ctx[2].top;
    			if (dirty & /*bodiesSnake*/ 2) bodysnake_changes.left = /*bodySnake*/ ctx[2].left;
    			if (dirty & /*direction*/ 1) bodysnake_changes.direction = /*direction*/ ctx[0];
    			bodysnake.$set(bodysnake_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(bodysnake.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(bodysnake.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(bodysnake, detaching);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*bodiesSnake*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*bodiesSnake, direction*/ 3) {
    				each_value = /*bodiesSnake*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { direction } = $$props;
    	let { bodiesSnake = [] } = $$props;

    	$$self.$set = $$props => {
    		if ("direction" in $$props) $$invalidate(0, direction = $$props.direction);
    		if ("bodiesSnake" in $$props) $$invalidate(1, bodiesSnake = $$props.bodiesSnake);
    	};

    	return [direction, bodiesSnake];
    }

    class Snake extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { direction: 0, bodiesSnake: 1 });
    	}
    }

    /* src\Fruit.svelte generated by Svelte v3.22.2 */

    function create_fragment$2(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", "fruit svelte-1exm24u");
    			set_style(div, "left", /*fruitLeft*/ ctx[1] + "px");
    			set_style(div, "top", /*fruitTop*/ ctx[0] + "px");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*fruitLeft*/ 2) {
    				set_style(div, "left", /*fruitLeft*/ ctx[1] + "px");
    			}

    			if (dirty & /*fruitTop*/ 1) {
    				set_style(div, "top", /*fruitTop*/ ctx[0] + "px");
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { fruitTop } = $$props;
    	let { fruitLeft } = $$props;

    	$$self.$set = $$props => {
    		if ("fruitTop" in $$props) $$invalidate(0, fruitTop = $$props.fruitTop);
    		if ("fruitLeft" in $$props) $$invalidate(1, fruitLeft = $$props.fruitLeft);
    	};

    	return [fruitTop, fruitLeft];
    }

    class Fruit extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { fruitTop: 0, fruitLeft: 1 });
    	}
    }

    /* src\App.svelte generated by Svelte v3.22.2 */

    function create_fragment$3(ctx) {
    	let h1;
    	let t0;
    	let t1;
    	let t2;
    	let main;
    	let t3;
    	let current;
    	let dispose;

    	const snake = new Snake({
    			props: {
    				direction: /*direction*/ ctx[3],
    				bodiesSnake: /*bodiesSnake*/ ctx[0]
    			}
    		});

    	const fruit = new Fruit({
    			props: {
    				fruitLeft: /*fruitLeft*/ ctx[1],
    				fruitTop: /*fruitTop*/ ctx[2]
    			}
    		});

    	return {
    		c() {
    			h1 = element("h1");
    			t0 = text("SNAKE GAME, Score: ");
    			t1 = text(/*score*/ ctx[4]);
    			t2 = space();
    			main = element("main");
    			create_component(snake.$$.fragment);
    			t3 = space();
    			create_component(fruit.$$.fragment);
    			attr(h1, "class", "svelte-131o2on");
    			attr(main, "class", "svelte-131o2on");
    		},
    		m(target, anchor, remount) {
    			insert(target, h1, anchor);
    			append(h1, t0);
    			append(h1, t1);
    			insert(target, t2, anchor);
    			insert(target, main, anchor);
    			mount_component(snake, main, null);
    			append(main, t3);
    			mount_component(fruit, main, null);
    			current = true;
    			if (remount) dispose();
    			dispose = listen(window, "keydown", /*onKeyDown*/ ctx[5]);
    		},
    		p(ctx, [dirty]) {
    			if (!current || dirty & /*score*/ 16) set_data(t1, /*score*/ ctx[4]);
    			const snake_changes = {};
    			if (dirty & /*direction*/ 8) snake_changes.direction = /*direction*/ ctx[3];
    			if (dirty & /*bodiesSnake*/ 1) snake_changes.bodiesSnake = /*bodiesSnake*/ ctx[0];
    			snake.$set(snake_changes);
    			const fruit_changes = {};
    			if (dirty & /*fruitLeft*/ 2) fruit_changes.fruitLeft = /*fruitLeft*/ ctx[1];
    			if (dirty & /*fruitTop*/ 4) fruit_changes.fruitTop = /*fruitTop*/ ctx[2];
    			fruit.$set(fruit_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(snake.$$.fragment, local);
    			transition_in(fruit.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(snake.$$.fragment, local);
    			transition_out(fruit.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(h1);
    			if (detaching) detach(t2);
    			if (detaching) detach(main);
    			destroy_component(snake);
    			destroy_component(fruit);
    			dispose();
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let bodiesSnake = [];
    	let fruitLeft = 0;
    	let fruitTop = 0;
    	let direction = "right";

    	class IsCollide {
    		isCollide(a, b) {
    			a.top < b.top || a.top > b.top || a.left < b.left || a.left > b.left;
    		}
    	}

    	class MoveFruit {
    		moveFruit() {
    			$$invalidate(2, fruitTop = Math.floor(Math.random() * 12) * 50);
    			$$invalidate(1, fruitLeft = Math.floor(Math.random() * 26) * 50);
    		}
    	}

    	class ResetGame {
    		constructor() {
    			moveFruit();
    			$$invalidate(3, direction = "right");
    			$$invalidate(0, bodiesSnake = [{ left: 100, top: 0 }, { left: 50, top: 0 }, { left: 0, top: 0 }]);
    		}
    	}

    	class GetDirectionFromKeyCode {
    		getDirectionFromKeyCode(keyCode) {
    			if (keyCode === 38) {
    				return "up";
    			} else if (keyCode === 39) {
    				return "right";
    			} else if (keyCode === 37) {
    				return "left";
    			} else if (keyCode === 40) {
    				return "down";
    			}

    			return false;
    		}
    	}

    	function onKeyDown(e) {
    		const newDirection = GetDirectionFromKeyCode(e.keyCode);

    		if (newDirection) {
    			$$invalidate(3, direction = newDirection);
    		}
    	}

    	class IsGameOver {
    		isGameOver() {
    			const bodiesSnakeNoHead = bodiesSnake.slice(1);
    			const snakeCollisions = bodiesSnakeNoHead.filter(bs => isCollide(bs, bodiesSnake[0]));

    			if (snakeCollisions.length > 0) {
    				return true;
    			}

    			const { top, left } = bodiesSnake[0];

    			if (top >= 600 || top < 0 || left < 0 || left >= 1300) {
    				return true;
    			}

    			return false;
    		}
    	}

    	setInterval(
    		() => {
    			bodiesSnake.pop();
    			let { left, top } = bodiesSnake[0];

    			if (direction === "up") {
    				top -= 50;
    			} else if (direction === "right") {
    				left += 50;
    			} else if (direction === "down") {
    				top += 50;
    			} else if (direction === "left") {
    				left -= 50;
    			}

    			const newHead = { left, top };
    			$$invalidate(0, bodiesSnake = [newHead, ...bodiesSnake]);

    			if (IsCollide(newHead, { left: fruitLeft, top: fruitTop })) {
    				MoveFruit();
    				$$invalidate(0, bodiesSnake = [...bodiesSnake, bodiesSnake[bodiesSnake.length - 1]]);
    			}

    			if (IsGameOver()) {
    				ResetGame();
    			}
    		},
    		200
    	);

    	ResetGame();
    	let score;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*bodiesSnake*/ 1) {
    			 $$invalidate(4, score = bodiesSnake.length - 3);
    		}
    	};

    	return [bodiesSnake, fruitLeft, fruitTop, direction, score, onKeyDown];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});
    	}
    }

    const app = new App({
      target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
