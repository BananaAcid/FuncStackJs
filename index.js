/**
 * FuncStack - Vanilla JS async tasks
 *
 * Starts different tasks (functions), optionally asyncronous, and monitors the total progress
 *
 * @summary
 *   The stack allows to execute a a bunch of tasks async, then wait for their completion to trigger another one.
 *   A task may use a resolve function, needed for AJAX requests and alike.
 *   onProgress will be triggered after each task with an overall status object and a the return result from a task.
 *   Module loading for AMD, CommonJS, Browser.
 *
 * @author  Nabil Redmann <repo+js@bananaacid.de>
 * @licence MIT
 *
 * @copyright  use in your own code, but keep the copyright (except you modify it, then reference me)
 *
 * NOTE: a factory is not used, because jsDoc has problems with it, but 'use strict' is anyways locking everything in to prevent global space polution
 */

'use strict';

/**
 * FuncStack prototype
 * 
 * @constructor
 * @param optionalOptions         can be the onComplete function or the options block or null to use default options
 * @param optionalInitialFnsArr   can be an array of functions to add (like using add() multiple times)
 */
function FuncStack(optionalOptions, optionalInitialFnsArr) {

    // the constructor was called without "new".
    if (!(this instanceof FuncStack))
        return new FuncStack(optionalOptions, optionalInitialFnsArr);


    /**
     * internal data
     */
    this._data = {
        queue: [],      // STACK:  calling it from top to bottom
        working: [],    // QUEUE:  newest will be appended to the bottom --  may hold any amount of async items or one defer item
        done: [],       // QUEUE:  newest will be appended to the bottom
        error: [],      // QUEUE:  newest will be appended to the bottom
        startCount: null
    };
    /**
     * internal data
     */
    this._internal = {
        fnCount: 0,
        restarted: 0,
        paused: false
    };
    /**
     * Defaults
     * @description  we do not use a complicated array merge here - we just throw at the instance
     */
    this.options = {
        onCompleted: function defaultHandlerExample(statusObj) {console.log('!! FuncStack: executed all.');},
        onProgress:  function defaultHandlerExample(statusObj, curFn) {console.log('!! FuncStack: progress', arguments);},
        onStart:     function defaultHandlerExample(initialLen, dataObjRef, wasPaused) {},
        onError:     function defaultHandlerExample(statusObj, curFn) {},
        defaultQueueMode: FuncStack.ENUM_QUEUEMODE.ASYNC, // or .DEFER
        enforceDefaultQueueMode: false,
        manualConsume: false,   // if you want to call _consume manually, to work the next block of functions
        addMode: FuncStack.ENUM_ADDMODE.BOTTOM,    // add new fns to bottom or top / like a queue or stack
        debug: false
    };



    if (optionalOptions) {
        if (typeof(optionalOptions)==='function')
            this.options.onCompleted = optionalOptions;
        else
            for (var key in optionalOptions) /* extend options */
                this.options[key] = optionalOptions[key];
    }
    
     if (optionalInitialFnsArr)
        this.add(optionalInitialFnsArr);
}

// enums
/** @enum {string} @readonly */
FuncStack.ENUM_STATUS = {SUCCESS: 'success', ERROR: 'error', CANCELED: 'canceled'};
/** @enum {string} @readonly */
FuncStack.ENUM_STATE = {QUEUE: 'queue', WORKING: 'working', DONE: 'done', ERROR: 'error', CANCELED: 'error'};
/** @enum {number} @readonly */
FuncStack.ENUM_ADDMODE = {BOTTOM: 0, TOP: 1};
/** @enum {string} @readonly */
FuncStack.ENUM_QUEUEMODE = {ASYNC: 'async', DEFER: 'defer'};

/**
 * Add a function or an array of functions to the stack
 *
 * @description
 *   - If the fn must run in a certain scope, use fn.bind(scopeObject);
 *   - To get the fn moved to error, it must throw() an error, that error will be used as result and onError() will be triggered
 *  
 *   The callback fn will be called with "this" referencing the function itself 
 *   (you can set this.x=1 in the fn and in onProgress you can access it)
 *   and the first param referencing current the FuncStack
 *
 * @param {function|array<fn>|array<object>} fn  the function or an array of functions, or array of {addMode:bool, fn:function}, to add to the stack
 * @param {FuncStack.ENUM_QUEUEMODE} queueMode   if to call the function async or defer it (sync) (continue if queue is empty) [optional]
 * @returns {FuncStack}
 */
FuncStack.prototype.add = function add(fn, queueMode) {
    if (typeof(fn)=='function')
        fn = [fn];
    
    else if (Array.isArray(fn))
        for (var i in fn) {
            var f = fn[i],
                m = this.options.addMode;

            // it might be an obj {addMode:bool, fn:function}
            if (!(f instanceof Function)) {
                m = f.addMode;
                f = f.fn;
            }

            f.fnCount = this._internal.fnCount;
            f.queueMode = (this.options.enforceDefaultQueueMode) ? this.options.defaultQueueMode : (queueMode || this.options.defaultQueueMode);
            //this._data.queue.unshift(f); // add on top
            Array.prototype[(!m) ? 'push' : 'unshift'].call(this._data.queue, f);
            this._internal.fnCount++;
        }

    else 
        throw new Error('add argument must be function, array of funcitons or array of {addMode:bool, fn:function}')
    
    return this; // for chaining
};

/**
 * Add one function like add(), BUT return its id
 *
 * @param {function} fn                         the function to add to the stack
 * @param {FuncStack.ENUM_QUEUEMODE} queueMode  if to call the function async or defer (sync) (continue if queue is empty) [optional]
 * @returns {number}                             id of fn
 */
FuncStack.prototype.push = function pushOneFn(fn, queueMode) {
    this.add(fn, queueMode);
    return this._internal.fnCount - 1;
};

/**
 * Returns the amount of functions
 *
 * @returns {number}  number of total amount of functions
 */
FuncStack.prototype.length = function length() {
    return this._internal.fnCount;
};

/**
 * Check if a function is to be consumed (and calls _consume of not set to manually) + check if FuncStack is done doing all
 *
 * @internal
 * @description  using stackName, will only shift the fn to the new stack - then exit the func (called internally by cancel())
 *
 * @param {FuncStack.StatusNotificationObject} statusNotificationObj
 * @param {function} curFn
 * @param {FuncStack.ENUM_STATE} stackName
 */
FuncStack.prototype._check = function _check(statusNotificationObj, curFn, stackName) {

    var statusObj = new FuncStack.StatusObject(
        /*statusNotificationObj=*/ statusNotificationObj || new FuncStack.StatusNotificationObject(), 
        /*queueMode=*/ null, 
        /*queuesReference=*/ this._data, 
        /*counts=*/ {
            start: this._data.startCount,
            left: this._data.working.length + this._data.queue.length,
            finished: this._data.done.length + this._data.error.length,
            pending: this._data.queue.length,
            working: this._data.working.length,
            total: this._internal.fnCount
        }
    );
    
    // in case we do an initial check, curFn will be empty
    if (curFn) {
        statusObj.queueMode = curFn.queueMode;
        
        // get queue pos to remove fn
        var fnPos = this._data[stackName || 'working'].indexOf(curFn);

        this._data[stackName || 'working'].splice(fnPos, 1);

        switch (statusObj.status) {

            case FuncStack.ENUM_STATUS.SUCCESS:
                this._data.done.push(curFn);
                this.options.debug && console.log('FuncStack: *Progress [#' + curFn.fnCount+ ']', {statusObj: statusObj, curFn: curFn});
                this.options.onProgress.call(this, statusObj, curFn);
                break;

            case FuncStack.ENUM_STATUS.CANCELED:
            case FuncStack.ENUM_STATUS.ERROR:
                this._data.error.push(curFn);
                this.options.debug && console.log('FuncStack: *ERROR [#' + curFn.fnCount+ ']', {statusObj: statusObj, curFn: curFn});
                this.options.onError.call(this, statusObj, curFn);
                break;

            default:
                this._data.error.push(curFn);
                throw('FuncStack: status is faulty');
        }

        if (stackName) return; // this func was called internally by cancel()

        !this.options.manualConsume && this._consume();
    }
    
    var nowLeft = this._data.working.length + this._data.queue.length;
    
    this.options.debug && console.log('FuncStack: *Completed?', !nowLeft, ' left:', nowLeft);
    
    if (!nowLeft) {
        this.options.debug && console.log('FuncStack: *Executed all.', this);
        this.options.onCompleted.call(this, statusObj);
    }
};

/**
 * The internal check for _consume()
 * @internal
 */
FuncStack.prototype._consumeCheck = function _consumeCheck() {
    if (this.options.debug) {
        console.log('FuncStack:  - queue:0 async?', this._data.queue[0].queueMode == FuncStack.ENUM_QUEUEMODE.ASYNC);
        console.log('FuncStack:  - working == []?', !this._data.working.length);
        console.log('FuncStack:  - working > 0 && working:0 async?',  (!!this._data.working.length && this._data.working[0].queueMode == FuncStack.ENUM_QUEUEMODE.ASYNC));
    }
        
    return (
        // working is just empty
        (!this._data.working.length)
        // add fn if async and: working is empty or topmost containing item is async --- if a defer is in working -> wait
        || (this._data.queue[0].queueMode == FuncStack.ENUM_QUEUEMODE.ASYNC && (!!this._data.working.length && this._data.working[0].queueMode == FuncStack.ENUM_QUEUEMODE.ASYNC) )
        // if its a defer fn, working must be emtpy
        // obsolete:   || (this._data.queue[0].queueMode != FuncStack.ENUM_QUEUEMODE.ASYNC && !this._data.working.length)
    );
};

/**
 * Consume the next function
 * @internal
 *
 * @description   you may call this yourself (instead of start()), if you use options.manualConsume
 */
FuncStack.prototype._consume = function _consume() {
    if (this._internal.paused) return false;
    
    while (this._data.queue[0]) {
        this.options.debug && console.log('FuncStack: *check for Consume fn [#' + this._data.queue[0].fnCount+ ']', {fn:this._data.queue[0]}, this._data.queue[0].queueMode);
        
        if (this._consumeCheck()) {
            var fn = this._data.queue.shift();
            this._data.working.push( fn );
            
            this.options.debug && console.log('FuncStack:  -- Consume fn [#' + fn.fnCount + ']', {fn:fn}, fn.queueMode);

            // start function within a async status wrapper
            setTimeout(
                function fnWrapper() {
                    var holder = {waitForCallback: false /*, finished: false */},

                        /** status may be a FuncStack.StatusNotificationObject or a (status, result) */
                        resolveFn = function resolveFn(status, result) {
                            //if (this.holder.finished) {
                            var fnInfo = this.self.get(this.fn);
                            if (!fnInfo || fnInfo.state != FuncStack.ENUM_STATUS.WORKING) {
                                this.options.debug && console.info('FuncStack:  --- Error: resolved allready');
                                return false;
                            }

                            var statusObj = (status instanceof FuncStack.StatusNotificationObject) ? status : new FuncStack.StatusNotificationObject(
                                /*status=*/ status,
                                /*result=*/ result
                            );

                            this.self.options.debug && console.info('FuncStack:  --- resolveFN(status,result): ', status, result);

                            this.self._check.call(this.self, statusObj, this.fn);

                            this.holder.finished = true;
                            return true;
                        }.bind({self: this.self, holder: holder, options: this.self.options, fn: this.fn}),

                        data = {
                            preventDefault: function preventDefault() {
                                this.holder.waitForCallback = true;

                                this.options.debug && console.info('FuncStack:  --- preventDefault! (continue when resolveFn() gets called)');

                                return resolveFn;
                            }.bind({holder: holder, options: this.self.options}),
                            fnCount: this.fn.fnCount,
                            queueMode: this.fn.queueMode,
                            funcStackReference: this.self,
                            self: this.fn
                        };


                    var ret, err;
                    // try to run function
                    try {
                        ret = this.fn.bind(this.fn)(data); // DO NOT USE localScopeObj -> fn has several exclusive properties [fnCount, queueMode] (but this [without .call() will preserve the bind if there is any])
                    } catch (e) {
                        err = e;
                    }

                    this.self.options.debug && console.info('FuncStack:  --- fnWrapper(): ', 'waitForCallback', holder.waitForCallback, 'ret', ret);

                    if (!holder.waitForCallback || (holder.waitForCallback && err) || err)
                        resolveFn((!err) ? FuncStack.ENUM_STATUS.SUCCESS : FuncStack.ENUM_STATUS.ERROR, ret || err);

                }.bind(/*localScopeObj=*/{fn: fn, self: this})  // just to make clear, what we are passing into this wrapper
                , 0  // just run it async
            );
        }
        else {
            this.options.debug && console.log('FuncStack:  --X Stop. Waiting for working. next in queue [#' + this._data.queue[0].fnCount+ '] :', {fn:this._data.queue[0]}, this._data.queue[0].queueMode);
            break;
        }
    }
    
};

/**
 * Start queue tasks.
 *
 * @description  and resumes after stop()
 *
 * @returns {FuncStack}
 */
FuncStack.prototype.start = function start() {
    if (this._data.startCount == null)
        this._data.startCount = this._data.queue.length;
    
    this._internal.paused = false;
    
    var wasPaused = (this._data.startCount!=this._data.queue.length);
    this.options.onStart(this.options.startCount, this._data, wasPaused);
    
    !this.options.manualConsume && this._consume();
    
    this._check();
    
    return this;
};

/**
 * Remove a fn from any queue, and triggers cancel with status "canceled"
 *
 * @param {number|string|function} id   refers to get()
 * @param {function} validateFn         [optional] if set, gets the fnInfo obj (FuncStack.FnInfoObject) as param and should return true to really remove the function
 * @returns {boolean|null}               boolean if successfull or not, null on error
 */
FuncStack.prototype.cancel = function removeFnFromQueue(id, validateFn) {
    var fnInfo = this.get(id); 

    if (!fnInfo || fnInfo.state != FuncStack.ENUM_STATUS.WORKING) {
        this.options.debug && console.info('FuncStack:  --- Error: resolved allready, can not cancel', fnInfo);
        return null;
    }
    
    if (!fnInfo || (validateFn && !validateFn(fnInfo))) {
        this.options.debug && console.info('FuncStack:  --- Rejected by validateFn to cancel fn', fnInfo);
        return false;
    }

    var statusObj = new FuncStack.StatusNotificationObject(
        /*status=*/ FuncStack.ENUM_STATUS.CANCELED,
        /*result=*/ undefined
    );
    this._check.call(this, statusObj, fnInfo.fn, fnInfo.stack);

    return true;
};

/**
 * Restart by requeueing all functions and triggering start()
 *
 * @param {boolean} excludeErrors  default = false
 */
FuncStack.prototype.restart = function restartAllExecFns(excludeErrors) {
    this._internal.restarted++;
    
    var fnBackup = this._data.working.combine(this._data.done.concat((excludeErrors) ? [] : this._data.error));
    
    // sort in the original way
    fnBackup.sort(function queueSort(a,b) {
        return b.fnCount - a.fnCount;
    });
    
    // do some GC stuff
    this._gc(ignoreInternal=true);
    
    // rearm
    this._data.queue = fnBackup;
    
    // fire
    return this.start();
};

/**
 * Stop processing the stack
 * 
 * @description
 *   will not cancel currently running fns,
 *   but keep new ones from spawning.
 *
 *   to resume, call start()
 */
FuncStack.prototype.stop = function pauseConsume() {
    this._internal.paused = true;
};

/**
 * will tell, if the stack is paused
 *
 * @returns {boolean}
 */
FuncStack.prototype.isStopped = function isPauseConsume() {
    return this._internal.paused;
}

/**
 * Get all info about a fn
 *
 * @description
 * <xmp>
 * id : if number, it checks for the add-id
 *      if string, it checks the function name (if fn was named)
 *      if fn, it checks for the function
 * </xmp>
 * 
 * @param {number|string|functino}  id to find a function
 * @returns {FuncStack.FnInfoObject|false} if not found, return false
 */
FuncStack.prototype.get = function getFn(id) {
    var key = !isNaN(id) ? 'fnCount' : 'name';
    for (var s in this._data)
        if (this._data[s] instanceof Array)
            for (var fnKey in this._data[s])
                if (this._data[s][fnKey][key] == id || this._data[s][fnKey] == id)  // (id || fn name) || fn
                    return new FuncStack.FnInfoObject(this._data[s][fnKey], s, fnKey, this._data[s][fnKey]['fnCount']);
                    // {fn: this._data[s][fnKey], stack: s, pos: fnKey, id: this._data[s][fnKey]['fnCount']};
    return false;
};

/**
 * Removes all functions, leaves the handlers alone
 *
 * @description  you should actually create a new FuncStack instance instead !
 */
FuncStack.prototype.clear = function removeAllFns() {
    this._gc();
};

/**
 * Remove all references used by this FuncStack instance
 * @internal
 */
FuncStack.prototype._gc = function garbageCollect(ignoreInternal) {
     
    // release references, at least those, hold by funcStack
    for (i in this._data)
       this._data[i] = this._reset(this._data[i]);
    
    if (!ignoreInternal)
        for (i in this._internal)
            this._data[i] = this._reset(this._internal[i]);
    
    // specific fix
    this._data.startCount = null;
    
    
    // if chrome was launched like  chrome --js-flags='--expose_gc'
    window['gc'] && window.gc();
    
    return this;
};

/**
 * Used by gc()
 * @internal
 */
FuncStack.prototype._reset = function resetObject(o) {
    if (typeof(o) == 'object') // array and object
        for(var i in o)
            delete o[i];    // delete enforces the GC in some browsers

    if (o instanceof Array)
        o = [];
    else if (o instanceof Object) // array evals to true here - so else if this second
        o = {};
    else if (typeof(o) == 'number' || o instanceof Number)
        o = 0;
    else if (typeof(o) == 'string' || o instanceof String)
        o = '';
    else if (o instanceof Function)
        o = function(){};

    return o;   // giveup/dispose reference to object itself by replacing with a new one (fixes some GC browser issues)
};



/**
 * Function Info Object prototype
 *
 * @constructor
 * @param {function} fn
 * @param {FuncStack.ENUM_STACK} stack
 * @param {number} pos
 * @param {number} id 
 */
FuncStack.FnInfoObject = function(fn, stack, pos, id) {

    // the constructor was called without "new".
    if (!(this instanceof FuncStack.FnInfoObject))
        return new FuncStack.FnInfoObject(fn, stack, pos, id);

    this.fn = fn;
    this.stack = stack;
    this.pos = pos;
    this.id = id;
};


/**
 * Status Notification Object prototype
 *
 * @constructor
 * @param {FuncStack.ENUM_STATUS} status   ['success', 'error', 'canceled']  -> FuncStack.ENUM_STATUS.*
 * @param {any}                   result   anything returned from the fn
 **/
FuncStack.StatusNotificationObject = function StatusNotificationObject(status, result) {

    // the constructor was called without "new".
    if (!(this instanceof FuncStack.StatusNotificationObject))
        return new FuncStack.StatusNotificationObject(status, result);

    this.status = status;
    this.result = result;
};

/**
 * Status Object prototype
 * 
 * @constructor
 * @description
 * <xmp>
 *  the created object has the following properties:
 * 
 *   -> statusNotificationObject
 *   .status                  -> ['success', 'error', 'canceled']  -> FuncStack.ENUM_STATUS.*
 *   .result                  -> anything returned from the fn
 *
 *   .queueMode               -> the queue mode used for this function
 *   .queuesReference         -> the _data object with the queues
 *   .counts -> countObject
 *      .start:     _data.startCount
 *      .left:      _data.working.length + _data.queue.length
 *      .finished:  _data.done.length    + _data.error.length
 *      .pending:   _data.queue.length
 *      .working:   _data.working.length
 *      .total:     _internal.fnCount
 * </xmp>
 * 
 * @param {FuncStack.StatusNotificationObject} statusNotificationObject
 * @param {FuncStack.ENUM_QUEUEMODE} queueMode
 * @param {array} queuesReference
 * @param {object} countObject
 **/
FuncStack.StatusObject = function StatusObject(statusNotificationObject, queueMode, queuesReference, countObject) {

    // the constructor was called without "new".
    if (!(this instanceof FuncStack.StatusObject))
        return new FuncStack.StatusObject(statusNotificationObject, queueMode, queuesReference, countObject);

    this.status = statusNotificationObject.status;
    this.result = statusNotificationObject.result;

    this.queueMode = queueMode;
    this.queuesReference = queuesReference;
    this.counts = countObject;
};


/**
 * Returns a promise to the current FuncStack and starts it
 *
 * @note  could also be a simple `let resultStatusObj = await new Promise(resolve => new FuncStack(resolve, fns).start());`
 * 
 * @return Promise  an awaitable promise
 **/
FuncStack.prototype.Promise = function FuncStackPromise() {
    return new Promise(resolve => {this.options.onCompleted = resolve; this.start(); });
}



// AMD, CommonJS, Browser
if (typeof define === 'function' && define.amd) {
    define(function () {
        return FuncStack;
    });
}
else if (typeof module !== 'undefined' && module.exports) {
    module.exports = FuncStack;
}
else {
    window.FuncStack = FuncStack;
}





// supply missing bind --- https://gist.github.com/1597825
/**
 * Function.bind Polyfill for ECMAScript 5 Support
 * Kangax's bind with Broofa's arg optimization.
 * http://www.broofa.com/Tools/JSLitmus/tests/PrototypeBind.html
 */
if (typeof Function.prototype.bind !== "function") {
    Function.prototype.bind = function() {
        var slice = Array.prototype.slice;
        return function(context) {
            var fn = this,
                args = slice.call(arguments, 1);
            if (args.length) {
                return function() {
                    return arguments.length
                        ? fn.apply(context, args.concat(slice.call(arguments)))
                        : fn.apply(context, args);
                };
            }
            return function() {
                return arguments.length
                    ? fn.apply(context, arguments)
                    : fn.call(context);
            };
        };
    };
}


/**
 * supply missing isArray
 * @see  https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray
 **/
if(!Array.isArray) {
  Array.isArray = function (vArg) {
    return Object.prototype.toString.call(vArg) === "[object Array]";
  };
}