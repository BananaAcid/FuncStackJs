
// tests

var s = new FuncStack({debug:true}, [
	function abc(funcStackRef){console.log('==1')},
	function def(){console.log('==2')}
])
.add(function ghi(){console.log('==3 s')}, FuncStack.ENUM_QUEUEMODE.DEFER)
.add(function jkl(){console.log('==4')})
.start();


var s = new FuncStack({debug:true})
.add(function abc(funcStackRef){console.log('==1')})
.add(function def(){console.log('==2')})
.add(function ghi(){console.log('==3 s')}, 'defer')
.add(function jkl(){console.log('==4')})
.add(function mno(){console.log('==5 s'); throw({msg: 'this is an error'});}, 'defer')
.add(function opq(){console.log('==6 s')}, FuncStack.ENUM_QUEUEMODE.DEFER)
.add(function rst(){console.log('==7 s')}, FuncStack.ENUM_QUEUEMODE.DEFER)
.add(function uvw(){console.log('==8'); throw({msg: 'this is an error'});})
.add(function xyz(){console.log('==9')})
.add([function zqwe1(){console.log('==10')}, function(){console.log('==11')}, function(){console.log('==12')}], FuncStack.ENUM_QUEUEMODE.DEFER)
.start();


// add param to abc func that can be used in "onProgress"
var s = new FuncStack({
    debug:false,
    onProgress: function defaultHandlerExample(statusObj, curFn) {
        if (curFn.x )
            console.log('x!', curFn.x);
    }
})
.add( function funcConstructor() {function abc(){console.log('==1', this.x); this.x = 'who2';}; abc.x = 'whoooh!'; return abc;}() ) // instead of (), it could use "new ..."
    //  ==1 whoooh!
    //  x! who2!
.add( function funcConstructor() {function abc2(){this.x = 'who2'; console.log('==1.2', this.x);}; abc2.x = 'whoooh!'; return abc2;}() ) // instead of (), it could use "new ..."
    //  ==1 who2!
    //  x! who2!
.add(function def(){console.log('==2')})
.add(function ghi(){console.log('==3 s')}, FuncStack.ENUM_QUEUEMODE.DEFER)
.add(function jkl(){console.log('==4')})
.add(function mno(){console.log('==5 s'); throw({msg: 'this is an error'});}, FuncStack.ENUM_QUEUEMODE.DEFER)
.add(function opq(){console.log('==6 s')}, FuncStack.ENUM_QUEUEMODE.DEFER)
.add(function rst(){console.log('==7 s')}, FuncStack.ENUM_QUEUEMODE.DEFER)
.add(function uvw(){console.log('==8'); throw({msg: 'this is an error'});})
.add(function xyz(){console.log('==9')})
.add([function zqwe1(){console.log('==10')}, function(){console.log('==11')}, function(){console.log('==12')}], FuncStack.ENUM_QUEUEMODE.DEFER)
.start();


// async resolve by calling done() [resolveFn()]

var s1 = new FuncStack({debug: true})
.add(function task1(fsData) {
    var done = fsData.preventDefault();

    console.log('FN GOING');

    setTimeout(function() {

        done('success');

    }, 2000);
    
}).start();


// async example usage

var s = new FuncStack()
.add(function task1(fsData) {
    var done = fsData.preventDefault();

    $.get('/json')
    .done(function(data) {
        done('success', data);
    })
    .fail(function() {
        done('error');
    });
})
.start();


// some calls

var fn = s.get('task1');
s.cancel('task1');


// async time out example:

var s = new FuncStack({debug: true})
.add(function task1(fsData) {
    var done = fsData.preventDefault();

    console.log('FN GOING 1');
    setTimeout(function() {
        done('success');
    },3000);
    
})
.add(function task2(fsData) {
   var done = fsData.preventDefault();

    console.log('FN GOING 2');
    setTimeout(function() {
        done('success');
    },2750);
    
})
.add(function task3(fsData) {
    var done = fsData.preventDefault();

    console.log('FN GOING 3', this, fsData);
    setTimeout(function() {
        done('success');
    },2500);
    
})
.start();
