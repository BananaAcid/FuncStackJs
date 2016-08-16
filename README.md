# __FuncStack - Vanilla JS async tasks__

*Starts different tasks (functions), optionally asyncronous, and monitors the total progress*

# Summary
  The stack allows to execute a a bunch of tasks async, then wait for their completion to trigger another one.
  A task may use a resolve function, needed for AJAX requests and alike.
  onProgress will be triggered after each task with an overall status object and a the return result from a task.
  Module loading for AMD, CommonJS, Browser.

@author  Nabil Redmann <repo+js@bananaacid.de>

@version 1.0.0

@licence MIT

@copyright  use in your own code, but keep the copyright (except you modify it, then reference me)

# Documentation
You should really generate the jsDoc based documentation: go to the path where this lib is, and use
`npm run doc` or `npm run devdoc` (with overwritable internal methods).
If you have trouble as windows user, use the included `jsdoc_generate.cmd` (but requires a reachable jsDoc installation, `npm install -g jsdoc`) .

# Example
```javascript
// init
var s = new FuncStack({
    debug:false,
    onProgress: function defaultHandlerExample(statusObj, curFn) {
        console.log('another one finished, still missing: ', statusObj.count.left);

        if (curFn.x )
            console.log('Fn has an extra value (x):', curFn.x);
    }
})

// async execution
.add(function task1(){console.log('==1')})
// sync execution
.add(function task2(){console.log('==2 sync')}, FuncStack.ENUM_QUEUEMODE.DEFER)
// failing one
.add(function task3(){console.log('==3 err'); throw({msg: 'this is an error'});})
// transporting value to onProgress
.add(function task4(){console.log('==4'); this.x = 1;})
// ES6
.add( () => console.log('==5') )
// async execution + async callback
.add(function task6(fsData) {
    var done = fsData.preventDefault();
    console.log('==6 starting...');
    setTimeout(function() {
        console.log('==6 finished');
        done('success');
    }, 2000);
})
// with a binded context
.add(function task7(){console.log('=='+this.val);}.bind({val: 7}))

// start consuming
.start();
```

# Note

## a task function has:
```
signature param: [data]
    property keys: [fnCount, queueMode, funcStackReference, fn]
    property methods: [preventDefault()]
        preventDefault():                           (using this, return will be stopped and you must call resolveFn(status, result) to trigger task as proccessed -- use for ajax requests)
            returns: resolveFn() 
                signature param: [status, result]   (status ['error', 'success', 'canceled'] in FuncStack.ENUM_STATUS.*)
                signature overloaded: [FuncStack.StatusNotificationObject]
                    signature param: [status, result] (same as resolveFn)
return: any                                         (triggers task as proccessed -> stack: done)
throw: error                                        (triggers task as proccessed -> stack: error)
```` 

## onProgress statusObj has:
```
.status                  -> ['success', 'error', 'canceled']  -> FuncStack.ENUM_STATUS.*
.result                  -> anything returned from the fn
.queueMode               -> the queue mode used for this function
.data                    -> the _data object with the queues
.count
    .start:     _data.startCount
    .left:      _data.working.length + _data.queue.length
    .finished:  _data.done.length    + _data.error.length
    .pending:   _data.queue.length
    .working:   _data.working.length
    .total:     _internal.fnCount
```

## The options object has:
```
options = {
    onCompleted: function defaultHandlerExample(statusObj) {console.log('!! FuncStack: executed all.');},
    onProgress: function defaultHandlerExample(statusObj, curFn) {console.log('!! FuncStack: progress', arguments);},
    onStart: function defaultHandlerExample(initialLen, dataObjRef, wasPaused) {},
    onError: function defaultHandlerExample(statusObj, curFn) {},
    defaultQueueMode: FuncStack.ENUM_QUEUEMODE.ASYNC, // or defer
    enforceDefaultQueueMode: false,
    manualConsume: false,   // if you want to call _consume manually, to work the next block of functions
    addMode: FuncStack.ENUM_ADDMODE.BOTTOM,    // add new fns to bottom or top / like a queue or stack
    debug: false
}
```

## `.get()` returns an object of type `FuncStack.FnInfoObject`:
- fn -> the function / task
- stack -> the stack name where the task ended in
- pos -> the position within the stack
- id -> the internal identifier


## about async and defer:
- async will start them in order as fast as possible without waiting for completion, 
- defer will wait for previous defer task or all previous async tasks to start the new one


## about returns from fns / results:
these will be passed to `onProgress()`


## checking for tasks in the queues:
either use `var x = theFuncStack.get(id or fn).stack;`
or mess with the internals `theFuncStack._data.*` array


## adding values to transport to progress:
within the task, you can use `this.value = 'something';` and in onProgress(statusObj, curFn) use `if (curFn.value) ....`


## identifying a task in onProgress:
in onProgress(statusObj, curFn) you can:
- `curFn.name == 'abc'
- `this.get(curFn).id` -> .stack and more


## let the task check its own status for 'canceled' and paused:
within your timed function, you way use `myFuncStack.get(this).stack == FuncStack.ENUM_STATE.CANCELED` to check,
if it has been moved to the error stack - since it has not returned yet / called done(), there is no other reason

also: you could check `myFuncStack.isStopped == true` -> that tells, if tasks are currently consumed - but this task 
should finish anyway.


## resolve a ajax based task manually:
- first of, create your task with 1 param 'fsData':
    - `var done = fsData.preventDefault();`
- then call in your ajax success:
    - `done('success');`

- .. which is the short version for:
    ```
    done( 'success', undefined )
    done( FuncStack.ENUM_STATUS.SUCCESS, undefined )
    done( new FuncStack.StatusNotificationObject( FuncStack.ENUM_STATUS.SUCCESS, undefined ) )
    ```

- done() has 2 signatures:
    ```
    done( status, optionalResult )
    done( FuncStack.StatusNotificationObject(status, optionalResult) )
    ```
