@ECHO OFF
echo creating JsDoc of "FuncStack.js"
REM  subst is required, since jsdoc can not handle execution paths with spaces
subst j: .
pushd j:
REM  jsdoc kills this script, so we call it using cmd /C
cmd /C jsdoc --access all -c jsdoc.config.json --tutorials tests -R README.md FuncStack.js
popd
subst j: /D
start out\index.html
pause
