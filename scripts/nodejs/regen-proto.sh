export PROTO_PATH=shared/javascript/core-lib/src/proto
rm -rf $PROTO_PATH/messages.cjs
pbjs -t static-module -w commonjs -o $PROTO_PATH/messages.js $PROTO_PATH/messages.proto
pbts -o $PROTO_PATH/messages.d.ts $PROTO_PATH/messages.js
mv $PROTO_PATH/messages.js $PROTO_PATH/messages.cjs
