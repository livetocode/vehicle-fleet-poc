/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.ServiceIdentity = (function() {

    /**
     * Properties of a ServiceIdentity.
     * @exports IServiceIdentity
     * @interface IServiceIdentity
     * @property {string|null} [name] ServiceIdentity name
     * @property {number|null} [instance] ServiceIdentity instance
     */

    /**
     * Constructs a new ServiceIdentity.
     * @exports ServiceIdentity
     * @classdesc Represents a ServiceIdentity.
     * @implements IServiceIdentity
     * @constructor
     * @param {IServiceIdentity=} [properties] Properties to set
     */
    function ServiceIdentity(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * ServiceIdentity name.
     * @member {string} name
     * @memberof ServiceIdentity
     * @instance
     */
    ServiceIdentity.prototype.name = "";

    /**
     * ServiceIdentity instance.
     * @member {number} instance
     * @memberof ServiceIdentity
     * @instance
     */
    ServiceIdentity.prototype.instance = 0;

    /**
     * Creates a new ServiceIdentity instance using the specified properties.
     * @function create
     * @memberof ServiceIdentity
     * @static
     * @param {IServiceIdentity=} [properties] Properties to set
     * @returns {ServiceIdentity} ServiceIdentity instance
     */
    ServiceIdentity.create = function create(properties) {
        return new ServiceIdentity(properties);
    };

    /**
     * Encodes the specified ServiceIdentity message. Does not implicitly {@link ServiceIdentity.verify|verify} messages.
     * @function encode
     * @memberof ServiceIdentity
     * @static
     * @param {IServiceIdentity} message ServiceIdentity message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ServiceIdentity.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.name != null && Object.hasOwnProperty.call(message, "name"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.name);
        if (message.instance != null && Object.hasOwnProperty.call(message, "instance"))
            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.instance);
        return writer;
    };

    /**
     * Encodes the specified ServiceIdentity message, length delimited. Does not implicitly {@link ServiceIdentity.verify|verify} messages.
     * @function encodeDelimited
     * @memberof ServiceIdentity
     * @static
     * @param {IServiceIdentity} message ServiceIdentity message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ServiceIdentity.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a ServiceIdentity message from the specified reader or buffer.
     * @function decode
     * @memberof ServiceIdentity
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {ServiceIdentity} ServiceIdentity
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ServiceIdentity.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ServiceIdentity();
        while (reader.pos < end) {
            var tag = reader.uint32();
            if (tag === error)
                break;
            switch (tag >>> 3) {
            case 1: {
                    message.name = reader.string();
                    break;
                }
            case 2: {
                    message.instance = reader.int32();
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a ServiceIdentity message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof ServiceIdentity
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {ServiceIdentity} ServiceIdentity
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ServiceIdentity.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ServiceIdentity message.
     * @function verify
     * @memberof ServiceIdentity
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ServiceIdentity.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.name != null && message.hasOwnProperty("name"))
            if (!$util.isString(message.name))
                return "name: string expected";
        if (message.instance != null && message.hasOwnProperty("instance"))
            if (!$util.isInteger(message.instance))
                return "instance: integer expected";
        return null;
    };

    /**
     * Creates a ServiceIdentity message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof ServiceIdentity
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {ServiceIdentity} ServiceIdentity
     */
    ServiceIdentity.fromObject = function fromObject(object) {
        if (object instanceof $root.ServiceIdentity)
            return object;
        var message = new $root.ServiceIdentity();
        if (object.name != null)
            message.name = String(object.name);
        if (object.instance != null)
            message.instance = object.instance | 0;
        return message;
    };

    /**
     * Creates a plain object from a ServiceIdentity message. Also converts values to other types if specified.
     * @function toObject
     * @memberof ServiceIdentity
     * @static
     * @param {ServiceIdentity} message ServiceIdentity
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ServiceIdentity.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.name = "";
            object.instance = 0;
        }
        if (message.name != null && message.hasOwnProperty("name"))
            object.name = message.name;
        if (message.instance != null && message.hasOwnProperty("instance"))
            object.instance = message.instance;
        return object;
    };

    /**
     * Converts this ServiceIdentity to JSON.
     * @function toJSON
     * @memberof ServiceIdentity
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ServiceIdentity.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for ServiceIdentity
     * @function getTypeUrl
     * @memberof ServiceIdentity
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    ServiceIdentity.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/ServiceIdentity";
    };

    return ServiceIdentity;
})();

$root.GpsCoordinates = (function() {

    /**
     * Properties of a GpsCoordinates.
     * @exports IGpsCoordinates
     * @interface IGpsCoordinates
     * @property {number|null} [lat] GpsCoordinates lat
     * @property {number|null} [lon] GpsCoordinates lon
     * @property {number|null} [alt] GpsCoordinates alt
     */

    /**
     * Constructs a new GpsCoordinates.
     * @exports GpsCoordinates
     * @classdesc Represents a GpsCoordinates.
     * @implements IGpsCoordinates
     * @constructor
     * @param {IGpsCoordinates=} [properties] Properties to set
     */
    function GpsCoordinates(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * GpsCoordinates lat.
     * @member {number} lat
     * @memberof GpsCoordinates
     * @instance
     */
    GpsCoordinates.prototype.lat = 0;

    /**
     * GpsCoordinates lon.
     * @member {number} lon
     * @memberof GpsCoordinates
     * @instance
     */
    GpsCoordinates.prototype.lon = 0;

    /**
     * GpsCoordinates alt.
     * @member {number} alt
     * @memberof GpsCoordinates
     * @instance
     */
    GpsCoordinates.prototype.alt = 0;

    /**
     * Creates a new GpsCoordinates instance using the specified properties.
     * @function create
     * @memberof GpsCoordinates
     * @static
     * @param {IGpsCoordinates=} [properties] Properties to set
     * @returns {GpsCoordinates} GpsCoordinates instance
     */
    GpsCoordinates.create = function create(properties) {
        return new GpsCoordinates(properties);
    };

    /**
     * Encodes the specified GpsCoordinates message. Does not implicitly {@link GpsCoordinates.verify|verify} messages.
     * @function encode
     * @memberof GpsCoordinates
     * @static
     * @param {IGpsCoordinates} message GpsCoordinates message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GpsCoordinates.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.lat != null && Object.hasOwnProperty.call(message, "lat"))
            writer.uint32(/* id 1, wireType 1 =*/9).double(message.lat);
        if (message.lon != null && Object.hasOwnProperty.call(message, "lon"))
            writer.uint32(/* id 2, wireType 1 =*/17).double(message.lon);
        if (message.alt != null && Object.hasOwnProperty.call(message, "alt"))
            writer.uint32(/* id 3, wireType 1 =*/25).double(message.alt);
        return writer;
    };

    /**
     * Encodes the specified GpsCoordinates message, length delimited. Does not implicitly {@link GpsCoordinates.verify|verify} messages.
     * @function encodeDelimited
     * @memberof GpsCoordinates
     * @static
     * @param {IGpsCoordinates} message GpsCoordinates message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GpsCoordinates.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GpsCoordinates message from the specified reader or buffer.
     * @function decode
     * @memberof GpsCoordinates
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {GpsCoordinates} GpsCoordinates
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GpsCoordinates.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.GpsCoordinates();
        while (reader.pos < end) {
            var tag = reader.uint32();
            if (tag === error)
                break;
            switch (tag >>> 3) {
            case 1: {
                    message.lat = reader.double();
                    break;
                }
            case 2: {
                    message.lon = reader.double();
                    break;
                }
            case 3: {
                    message.alt = reader.double();
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a GpsCoordinates message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof GpsCoordinates
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {GpsCoordinates} GpsCoordinates
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GpsCoordinates.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GpsCoordinates message.
     * @function verify
     * @memberof GpsCoordinates
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GpsCoordinates.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.lat != null && message.hasOwnProperty("lat"))
            if (typeof message.lat !== "number")
                return "lat: number expected";
        if (message.lon != null && message.hasOwnProperty("lon"))
            if (typeof message.lon !== "number")
                return "lon: number expected";
        if (message.alt != null && message.hasOwnProperty("alt"))
            if (typeof message.alt !== "number")
                return "alt: number expected";
        return null;
    };

    /**
     * Creates a GpsCoordinates message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof GpsCoordinates
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {GpsCoordinates} GpsCoordinates
     */
    GpsCoordinates.fromObject = function fromObject(object) {
        if (object instanceof $root.GpsCoordinates)
            return object;
        var message = new $root.GpsCoordinates();
        if (object.lat != null)
            message.lat = Number(object.lat);
        if (object.lon != null)
            message.lon = Number(object.lon);
        if (object.alt != null)
            message.alt = Number(object.alt);
        return message;
    };

    /**
     * Creates a plain object from a GpsCoordinates message. Also converts values to other types if specified.
     * @function toObject
     * @memberof GpsCoordinates
     * @static
     * @param {GpsCoordinates} message GpsCoordinates
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GpsCoordinates.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.lat = 0;
            object.lon = 0;
            object.alt = 0;
        }
        if (message.lat != null && message.hasOwnProperty("lat"))
            object.lat = options.json && !isFinite(message.lat) ? String(message.lat) : message.lat;
        if (message.lon != null && message.hasOwnProperty("lon"))
            object.lon = options.json && !isFinite(message.lon) ? String(message.lon) : message.lon;
        if (message.alt != null && message.hasOwnProperty("alt"))
            object.alt = options.json && !isFinite(message.alt) ? String(message.alt) : message.alt;
        return object;
    };

    /**
     * Converts this GpsCoordinates to JSON.
     * @function toJSON
     * @memberof GpsCoordinates
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GpsCoordinates.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GpsCoordinates
     * @function getTypeUrl
     * @memberof GpsCoordinates
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GpsCoordinates.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/GpsCoordinates";
    };

    return GpsCoordinates;
})();

$root.MessageTracking = (function() {

    /**
     * Properties of a MessageTracking.
     * @exports IMessageTracking
     * @interface IMessageTracking
     * @property {number|null} [sequence] MessageTracking sequence
     * @property {IServiceIdentity|null} [emitter] MessageTracking emitter
     */

    /**
     * Constructs a new MessageTracking.
     * @exports MessageTracking
     * @classdesc Represents a MessageTracking.
     * @implements IMessageTracking
     * @constructor
     * @param {IMessageTracking=} [properties] Properties to set
     */
    function MessageTracking(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * MessageTracking sequence.
     * @member {number} sequence
     * @memberof MessageTracking
     * @instance
     */
    MessageTracking.prototype.sequence = 0;

    /**
     * MessageTracking emitter.
     * @member {IServiceIdentity|null|undefined} emitter
     * @memberof MessageTracking
     * @instance
     */
    MessageTracking.prototype.emitter = null;

    /**
     * Creates a new MessageTracking instance using the specified properties.
     * @function create
     * @memberof MessageTracking
     * @static
     * @param {IMessageTracking=} [properties] Properties to set
     * @returns {MessageTracking} MessageTracking instance
     */
    MessageTracking.create = function create(properties) {
        return new MessageTracking(properties);
    };

    /**
     * Encodes the specified MessageTracking message. Does not implicitly {@link MessageTracking.verify|verify} messages.
     * @function encode
     * @memberof MessageTracking
     * @static
     * @param {IMessageTracking} message MessageTracking message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    MessageTracking.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.sequence != null && Object.hasOwnProperty.call(message, "sequence"))
            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.sequence);
        if (message.emitter != null && Object.hasOwnProperty.call(message, "emitter"))
            $root.ServiceIdentity.encode(message.emitter, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified MessageTracking message, length delimited. Does not implicitly {@link MessageTracking.verify|verify} messages.
     * @function encodeDelimited
     * @memberof MessageTracking
     * @static
     * @param {IMessageTracking} message MessageTracking message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    MessageTracking.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a MessageTracking message from the specified reader or buffer.
     * @function decode
     * @memberof MessageTracking
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {MessageTracking} MessageTracking
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    MessageTracking.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MessageTracking();
        while (reader.pos < end) {
            var tag = reader.uint32();
            if (tag === error)
                break;
            switch (tag >>> 3) {
            case 1: {
                    message.sequence = reader.int32();
                    break;
                }
            case 2: {
                    message.emitter = $root.ServiceIdentity.decode(reader, reader.uint32());
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a MessageTracking message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof MessageTracking
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {MessageTracking} MessageTracking
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    MessageTracking.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a MessageTracking message.
     * @function verify
     * @memberof MessageTracking
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    MessageTracking.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.sequence != null && message.hasOwnProperty("sequence"))
            if (!$util.isInteger(message.sequence))
                return "sequence: integer expected";
        if (message.emitter != null && message.hasOwnProperty("emitter")) {
            var error = $root.ServiceIdentity.verify(message.emitter);
            if (error)
                return "emitter." + error;
        }
        return null;
    };

    /**
     * Creates a MessageTracking message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof MessageTracking
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {MessageTracking} MessageTracking
     */
    MessageTracking.fromObject = function fromObject(object) {
        if (object instanceof $root.MessageTracking)
            return object;
        var message = new $root.MessageTracking();
        if (object.sequence != null)
            message.sequence = object.sequence | 0;
        if (object.emitter != null) {
            if (typeof object.emitter !== "object")
                throw TypeError(".MessageTracking.emitter: object expected");
            message.emitter = $root.ServiceIdentity.fromObject(object.emitter);
        }
        return message;
    };

    /**
     * Creates a plain object from a MessageTracking message. Also converts values to other types if specified.
     * @function toObject
     * @memberof MessageTracking
     * @static
     * @param {MessageTracking} message MessageTracking
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    MessageTracking.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.sequence = 0;
            object.emitter = null;
        }
        if (message.sequence != null && message.hasOwnProperty("sequence"))
            object.sequence = message.sequence;
        if (message.emitter != null && message.hasOwnProperty("emitter"))
            object.emitter = $root.ServiceIdentity.toObject(message.emitter, options);
        return object;
    };

    /**
     * Converts this MessageTracking to JSON.
     * @function toJSON
     * @memberof MessageTracking
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    MessageTracking.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for MessageTracking
     * @function getTypeUrl
     * @memberof MessageTracking
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    MessageTracking.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/MessageTracking";
    };

    return MessageTracking;
})();

$root.MoveCommand = (function() {

    /**
     * Properties of a MoveCommand.
     * @exports IMoveCommand
     * @interface IMoveCommand
     * @property {string|null} [vehicleId] MoveCommand vehicleId
     * @property {string|null} [vehicleType] MoveCommand vehicleType
     * @property {string|null} [zoneId] MoveCommand zoneId
     * @property {string|null} [direction] MoveCommand direction
     * @property {number|null} [speed] MoveCommand speed
     * @property {IGpsCoordinates|null} [gps] MoveCommand gps
     * @property {string|null} [timestamp] MoveCommand timestamp
     * @property {IMessageTracking|null} [tracking] MoveCommand tracking
     */

    /**
     * Constructs a new MoveCommand.
     * @exports MoveCommand
     * @classdesc Represents a MoveCommand.
     * @implements IMoveCommand
     * @constructor
     * @param {IMoveCommand=} [properties] Properties to set
     */
    function MoveCommand(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * MoveCommand vehicleId.
     * @member {string} vehicleId
     * @memberof MoveCommand
     * @instance
     */
    MoveCommand.prototype.vehicleId = "";

    /**
     * MoveCommand vehicleType.
     * @member {string} vehicleType
     * @memberof MoveCommand
     * @instance
     */
    MoveCommand.prototype.vehicleType = "";

    /**
     * MoveCommand zoneId.
     * @member {string} zoneId
     * @memberof MoveCommand
     * @instance
     */
    MoveCommand.prototype.zoneId = "";

    /**
     * MoveCommand direction.
     * @member {string} direction
     * @memberof MoveCommand
     * @instance
     */
    MoveCommand.prototype.direction = "";

    /**
     * MoveCommand speed.
     * @member {number} speed
     * @memberof MoveCommand
     * @instance
     */
    MoveCommand.prototype.speed = 0;

    /**
     * MoveCommand gps.
     * @member {IGpsCoordinates|null|undefined} gps
     * @memberof MoveCommand
     * @instance
     */
    MoveCommand.prototype.gps = null;

    /**
     * MoveCommand timestamp.
     * @member {string} timestamp
     * @memberof MoveCommand
     * @instance
     */
    MoveCommand.prototype.timestamp = "";

    /**
     * MoveCommand tracking.
     * @member {IMessageTracking|null|undefined} tracking
     * @memberof MoveCommand
     * @instance
     */
    MoveCommand.prototype.tracking = null;

    /**
     * Creates a new MoveCommand instance using the specified properties.
     * @function create
     * @memberof MoveCommand
     * @static
     * @param {IMoveCommand=} [properties] Properties to set
     * @returns {MoveCommand} MoveCommand instance
     */
    MoveCommand.create = function create(properties) {
        return new MoveCommand(properties);
    };

    /**
     * Encodes the specified MoveCommand message. Does not implicitly {@link MoveCommand.verify|verify} messages.
     * @function encode
     * @memberof MoveCommand
     * @static
     * @param {IMoveCommand} message MoveCommand message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    MoveCommand.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.vehicleId != null && Object.hasOwnProperty.call(message, "vehicleId"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.vehicleId);
        if (message.vehicleType != null && Object.hasOwnProperty.call(message, "vehicleType"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.vehicleType);
        if (message.zoneId != null && Object.hasOwnProperty.call(message, "zoneId"))
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.zoneId);
        if (message.direction != null && Object.hasOwnProperty.call(message, "direction"))
            writer.uint32(/* id 4, wireType 2 =*/34).string(message.direction);
        if (message.speed != null && Object.hasOwnProperty.call(message, "speed"))
            writer.uint32(/* id 5, wireType 1 =*/41).double(message.speed);
        if (message.gps != null && Object.hasOwnProperty.call(message, "gps"))
            $root.GpsCoordinates.encode(message.gps, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
        if (message.timestamp != null && Object.hasOwnProperty.call(message, "timestamp"))
            writer.uint32(/* id 7, wireType 2 =*/58).string(message.timestamp);
        if (message.tracking != null && Object.hasOwnProperty.call(message, "tracking"))
            $root.MessageTracking.encode(message.tracking, writer.uint32(/* id 8, wireType 2 =*/66).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified MoveCommand message, length delimited. Does not implicitly {@link MoveCommand.verify|verify} messages.
     * @function encodeDelimited
     * @memberof MoveCommand
     * @static
     * @param {IMoveCommand} message MoveCommand message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    MoveCommand.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a MoveCommand message from the specified reader or buffer.
     * @function decode
     * @memberof MoveCommand
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {MoveCommand} MoveCommand
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    MoveCommand.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MoveCommand();
        while (reader.pos < end) {
            var tag = reader.uint32();
            if (tag === error)
                break;
            switch (tag >>> 3) {
            case 1: {
                    message.vehicleId = reader.string();
                    break;
                }
            case 2: {
                    message.vehicleType = reader.string();
                    break;
                }
            case 3: {
                    message.zoneId = reader.string();
                    break;
                }
            case 4: {
                    message.direction = reader.string();
                    break;
                }
            case 5: {
                    message.speed = reader.double();
                    break;
                }
            case 6: {
                    message.gps = $root.GpsCoordinates.decode(reader, reader.uint32());
                    break;
                }
            case 7: {
                    message.timestamp = reader.string();
                    break;
                }
            case 8: {
                    message.tracking = $root.MessageTracking.decode(reader, reader.uint32());
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a MoveCommand message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof MoveCommand
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {MoveCommand} MoveCommand
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    MoveCommand.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a MoveCommand message.
     * @function verify
     * @memberof MoveCommand
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    MoveCommand.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.vehicleId != null && message.hasOwnProperty("vehicleId"))
            if (!$util.isString(message.vehicleId))
                return "vehicleId: string expected";
        if (message.vehicleType != null && message.hasOwnProperty("vehicleType"))
            if (!$util.isString(message.vehicleType))
                return "vehicleType: string expected";
        if (message.zoneId != null && message.hasOwnProperty("zoneId"))
            if (!$util.isString(message.zoneId))
                return "zoneId: string expected";
        if (message.direction != null && message.hasOwnProperty("direction"))
            if (!$util.isString(message.direction))
                return "direction: string expected";
        if (message.speed != null && message.hasOwnProperty("speed"))
            if (typeof message.speed !== "number")
                return "speed: number expected";
        if (message.gps != null && message.hasOwnProperty("gps")) {
            var error = $root.GpsCoordinates.verify(message.gps);
            if (error)
                return "gps." + error;
        }
        if (message.timestamp != null && message.hasOwnProperty("timestamp"))
            if (!$util.isString(message.timestamp))
                return "timestamp: string expected";
        if (message.tracking != null && message.hasOwnProperty("tracking")) {
            var error = $root.MessageTracking.verify(message.tracking);
            if (error)
                return "tracking." + error;
        }
        return null;
    };

    /**
     * Creates a MoveCommand message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof MoveCommand
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {MoveCommand} MoveCommand
     */
    MoveCommand.fromObject = function fromObject(object) {
        if (object instanceof $root.MoveCommand)
            return object;
        var message = new $root.MoveCommand();
        if (object.vehicleId != null)
            message.vehicleId = String(object.vehicleId);
        if (object.vehicleType != null)
            message.vehicleType = String(object.vehicleType);
        if (object.zoneId != null)
            message.zoneId = String(object.zoneId);
        if (object.direction != null)
            message.direction = String(object.direction);
        if (object.speed != null)
            message.speed = Number(object.speed);
        if (object.gps != null) {
            if (typeof object.gps !== "object")
                throw TypeError(".MoveCommand.gps: object expected");
            message.gps = $root.GpsCoordinates.fromObject(object.gps);
        }
        if (object.timestamp != null)
            message.timestamp = String(object.timestamp);
        if (object.tracking != null) {
            if (typeof object.tracking !== "object")
                throw TypeError(".MoveCommand.tracking: object expected");
            message.tracking = $root.MessageTracking.fromObject(object.tracking);
        }
        return message;
    };

    /**
     * Creates a plain object from a MoveCommand message. Also converts values to other types if specified.
     * @function toObject
     * @memberof MoveCommand
     * @static
     * @param {MoveCommand} message MoveCommand
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    MoveCommand.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.vehicleId = "";
            object.vehicleType = "";
            object.zoneId = "";
            object.direction = "";
            object.speed = 0;
            object.gps = null;
            object.timestamp = "";
            object.tracking = null;
        }
        if (message.vehicleId != null && message.hasOwnProperty("vehicleId"))
            object.vehicleId = message.vehicleId;
        if (message.vehicleType != null && message.hasOwnProperty("vehicleType"))
            object.vehicleType = message.vehicleType;
        if (message.zoneId != null && message.hasOwnProperty("zoneId"))
            object.zoneId = message.zoneId;
        if (message.direction != null && message.hasOwnProperty("direction"))
            object.direction = message.direction;
        if (message.speed != null && message.hasOwnProperty("speed"))
            object.speed = options.json && !isFinite(message.speed) ? String(message.speed) : message.speed;
        if (message.gps != null && message.hasOwnProperty("gps"))
            object.gps = $root.GpsCoordinates.toObject(message.gps, options);
        if (message.timestamp != null && message.hasOwnProperty("timestamp"))
            object.timestamp = message.timestamp;
        if (message.tracking != null && message.hasOwnProperty("tracking"))
            object.tracking = $root.MessageTracking.toObject(message.tracking, options);
        return object;
    };

    /**
     * Converts this MoveCommand to JSON.
     * @function toJSON
     * @memberof MoveCommand
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    MoveCommand.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for MoveCommand
     * @function getTypeUrl
     * @memberof MoveCommand
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    MoveCommand.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/MoveCommand";
    };

    return MoveCommand;
})();

$root.EnrichedMoveCommand = (function() {

    /**
     * Properties of an EnrichedMoveCommand.
     * @exports IEnrichedMoveCommand
     * @interface IEnrichedMoveCommand
     * @property {IMoveCommand|null} [command] EnrichedMoveCommand command
     * @property {number|null} [collectorIndex] EnrichedMoveCommand collectorIndex
     * @property {string|null} [geoHash] EnrichedMoveCommand geoHash
     * @property {string|null} [partitionKey] EnrichedMoveCommand partitionKey
     */

    /**
     * Constructs a new EnrichedMoveCommand.
     * @exports EnrichedMoveCommand
     * @classdesc Represents an EnrichedMoveCommand.
     * @implements IEnrichedMoveCommand
     * @constructor
     * @param {IEnrichedMoveCommand=} [properties] Properties to set
     */
    function EnrichedMoveCommand(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * EnrichedMoveCommand command.
     * @member {IMoveCommand|null|undefined} command
     * @memberof EnrichedMoveCommand
     * @instance
     */
    EnrichedMoveCommand.prototype.command = null;

    /**
     * EnrichedMoveCommand collectorIndex.
     * @member {number} collectorIndex
     * @memberof EnrichedMoveCommand
     * @instance
     */
    EnrichedMoveCommand.prototype.collectorIndex = 0;

    /**
     * EnrichedMoveCommand geoHash.
     * @member {string} geoHash
     * @memberof EnrichedMoveCommand
     * @instance
     */
    EnrichedMoveCommand.prototype.geoHash = "";

    /**
     * EnrichedMoveCommand partitionKey.
     * @member {string} partitionKey
     * @memberof EnrichedMoveCommand
     * @instance
     */
    EnrichedMoveCommand.prototype.partitionKey = "";

    /**
     * Creates a new EnrichedMoveCommand instance using the specified properties.
     * @function create
     * @memberof EnrichedMoveCommand
     * @static
     * @param {IEnrichedMoveCommand=} [properties] Properties to set
     * @returns {EnrichedMoveCommand} EnrichedMoveCommand instance
     */
    EnrichedMoveCommand.create = function create(properties) {
        return new EnrichedMoveCommand(properties);
    };

    /**
     * Encodes the specified EnrichedMoveCommand message. Does not implicitly {@link EnrichedMoveCommand.verify|verify} messages.
     * @function encode
     * @memberof EnrichedMoveCommand
     * @static
     * @param {IEnrichedMoveCommand} message EnrichedMoveCommand message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    EnrichedMoveCommand.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.command != null && Object.hasOwnProperty.call(message, "command"))
            $root.MoveCommand.encode(message.command, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        if (message.collectorIndex != null && Object.hasOwnProperty.call(message, "collectorIndex"))
            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.collectorIndex);
        if (message.geoHash != null && Object.hasOwnProperty.call(message, "geoHash"))
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.geoHash);
        if (message.partitionKey != null && Object.hasOwnProperty.call(message, "partitionKey"))
            writer.uint32(/* id 4, wireType 2 =*/34).string(message.partitionKey);
        return writer;
    };

    /**
     * Encodes the specified EnrichedMoveCommand message, length delimited. Does not implicitly {@link EnrichedMoveCommand.verify|verify} messages.
     * @function encodeDelimited
     * @memberof EnrichedMoveCommand
     * @static
     * @param {IEnrichedMoveCommand} message EnrichedMoveCommand message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    EnrichedMoveCommand.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an EnrichedMoveCommand message from the specified reader or buffer.
     * @function decode
     * @memberof EnrichedMoveCommand
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {EnrichedMoveCommand} EnrichedMoveCommand
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    EnrichedMoveCommand.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.EnrichedMoveCommand();
        while (reader.pos < end) {
            var tag = reader.uint32();
            if (tag === error)
                break;
            switch (tag >>> 3) {
            case 1: {
                    message.command = $root.MoveCommand.decode(reader, reader.uint32());
                    break;
                }
            case 2: {
                    message.collectorIndex = reader.int32();
                    break;
                }
            case 3: {
                    message.geoHash = reader.string();
                    break;
                }
            case 4: {
                    message.partitionKey = reader.string();
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an EnrichedMoveCommand message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof EnrichedMoveCommand
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {EnrichedMoveCommand} EnrichedMoveCommand
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    EnrichedMoveCommand.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an EnrichedMoveCommand message.
     * @function verify
     * @memberof EnrichedMoveCommand
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    EnrichedMoveCommand.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.command != null && message.hasOwnProperty("command")) {
            var error = $root.MoveCommand.verify(message.command);
            if (error)
                return "command." + error;
        }
        if (message.collectorIndex != null && message.hasOwnProperty("collectorIndex"))
            if (!$util.isInteger(message.collectorIndex))
                return "collectorIndex: integer expected";
        if (message.geoHash != null && message.hasOwnProperty("geoHash"))
            if (!$util.isString(message.geoHash))
                return "geoHash: string expected";
        if (message.partitionKey != null && message.hasOwnProperty("partitionKey"))
            if (!$util.isString(message.partitionKey))
                return "partitionKey: string expected";
        return null;
    };

    /**
     * Creates an EnrichedMoveCommand message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof EnrichedMoveCommand
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {EnrichedMoveCommand} EnrichedMoveCommand
     */
    EnrichedMoveCommand.fromObject = function fromObject(object) {
        if (object instanceof $root.EnrichedMoveCommand)
            return object;
        var message = new $root.EnrichedMoveCommand();
        if (object.command != null) {
            if (typeof object.command !== "object")
                throw TypeError(".EnrichedMoveCommand.command: object expected");
            message.command = $root.MoveCommand.fromObject(object.command);
        }
        if (object.collectorIndex != null)
            message.collectorIndex = object.collectorIndex | 0;
        if (object.geoHash != null)
            message.geoHash = String(object.geoHash);
        if (object.partitionKey != null)
            message.partitionKey = String(object.partitionKey);
        return message;
    };

    /**
     * Creates a plain object from an EnrichedMoveCommand message. Also converts values to other types if specified.
     * @function toObject
     * @memberof EnrichedMoveCommand
     * @static
     * @param {EnrichedMoveCommand} message EnrichedMoveCommand
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    EnrichedMoveCommand.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.command = null;
            object.collectorIndex = 0;
            object.geoHash = "";
            object.partitionKey = "";
        }
        if (message.command != null && message.hasOwnProperty("command"))
            object.command = $root.MoveCommand.toObject(message.command, options);
        if (message.collectorIndex != null && message.hasOwnProperty("collectorIndex"))
            object.collectorIndex = message.collectorIndex;
        if (message.geoHash != null && message.hasOwnProperty("geoHash"))
            object.geoHash = message.geoHash;
        if (message.partitionKey != null && message.hasOwnProperty("partitionKey"))
            object.partitionKey = message.partitionKey;
        return object;
    };

    /**
     * Converts this EnrichedMoveCommand to JSON.
     * @function toJSON
     * @memberof EnrichedMoveCommand
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    EnrichedMoveCommand.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for EnrichedMoveCommand
     * @function getTypeUrl
     * @memberof EnrichedMoveCommand
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    EnrichedMoveCommand.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/EnrichedMoveCommand";
    };

    return EnrichedMoveCommand;
})();

$root.VehicleQueryResult = (function() {

    /**
     * Properties of a VehicleQueryResult.
     * @exports IVehicleQueryResult
     * @interface IVehicleQueryResult
     * @property {string|null} [queryId] VehicleQueryResult queryId
     * @property {string|null} [timestamp] VehicleQueryResult timestamp
     * @property {string|null} [vehicleId] VehicleQueryResult vehicleId
     * @property {string|null} [vehicleType] VehicleQueryResult vehicleType
     * @property {IGpsCoordinates|null} [gps] VehicleQueryResult gps
     * @property {string|null} [direction] VehicleQueryResult direction
     * @property {number|null} [speed] VehicleQueryResult speed
     * @property {string|null} [geoHash] VehicleQueryResult geoHash
     */

    /**
     * Constructs a new VehicleQueryResult.
     * @exports VehicleQueryResult
     * @classdesc Represents a VehicleQueryResult.
     * @implements IVehicleQueryResult
     * @constructor
     * @param {IVehicleQueryResult=} [properties] Properties to set
     */
    function VehicleQueryResult(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * VehicleQueryResult queryId.
     * @member {string} queryId
     * @memberof VehicleQueryResult
     * @instance
     */
    VehicleQueryResult.prototype.queryId = "";

    /**
     * VehicleQueryResult timestamp.
     * @member {string} timestamp
     * @memberof VehicleQueryResult
     * @instance
     */
    VehicleQueryResult.prototype.timestamp = "";

    /**
     * VehicleQueryResult vehicleId.
     * @member {string} vehicleId
     * @memberof VehicleQueryResult
     * @instance
     */
    VehicleQueryResult.prototype.vehicleId = "";

    /**
     * VehicleQueryResult vehicleType.
     * @member {string} vehicleType
     * @memberof VehicleQueryResult
     * @instance
     */
    VehicleQueryResult.prototype.vehicleType = "";

    /**
     * VehicleQueryResult gps.
     * @member {IGpsCoordinates|null|undefined} gps
     * @memberof VehicleQueryResult
     * @instance
     */
    VehicleQueryResult.prototype.gps = null;

    /**
     * VehicleQueryResult direction.
     * @member {string} direction
     * @memberof VehicleQueryResult
     * @instance
     */
    VehicleQueryResult.prototype.direction = "";

    /**
     * VehicleQueryResult speed.
     * @member {number} speed
     * @memberof VehicleQueryResult
     * @instance
     */
    VehicleQueryResult.prototype.speed = 0;

    /**
     * VehicleQueryResult geoHash.
     * @member {string} geoHash
     * @memberof VehicleQueryResult
     * @instance
     */
    VehicleQueryResult.prototype.geoHash = "";

    /**
     * Creates a new VehicleQueryResult instance using the specified properties.
     * @function create
     * @memberof VehicleQueryResult
     * @static
     * @param {IVehicleQueryResult=} [properties] Properties to set
     * @returns {VehicleQueryResult} VehicleQueryResult instance
     */
    VehicleQueryResult.create = function create(properties) {
        return new VehicleQueryResult(properties);
    };

    /**
     * Encodes the specified VehicleQueryResult message. Does not implicitly {@link VehicleQueryResult.verify|verify} messages.
     * @function encode
     * @memberof VehicleQueryResult
     * @static
     * @param {IVehicleQueryResult} message VehicleQueryResult message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    VehicleQueryResult.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.queryId != null && Object.hasOwnProperty.call(message, "queryId"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.queryId);
        if (message.timestamp != null && Object.hasOwnProperty.call(message, "timestamp"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.timestamp);
        if (message.vehicleId != null && Object.hasOwnProperty.call(message, "vehicleId"))
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.vehicleId);
        if (message.vehicleType != null && Object.hasOwnProperty.call(message, "vehicleType"))
            writer.uint32(/* id 4, wireType 2 =*/34).string(message.vehicleType);
        if (message.gps != null && Object.hasOwnProperty.call(message, "gps"))
            $root.GpsCoordinates.encode(message.gps, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
        if (message.direction != null && Object.hasOwnProperty.call(message, "direction"))
            writer.uint32(/* id 6, wireType 2 =*/50).string(message.direction);
        if (message.speed != null && Object.hasOwnProperty.call(message, "speed"))
            writer.uint32(/* id 7, wireType 1 =*/57).double(message.speed);
        if (message.geoHash != null && Object.hasOwnProperty.call(message, "geoHash"))
            writer.uint32(/* id 8, wireType 2 =*/66).string(message.geoHash);
        return writer;
    };

    /**
     * Encodes the specified VehicleQueryResult message, length delimited. Does not implicitly {@link VehicleQueryResult.verify|verify} messages.
     * @function encodeDelimited
     * @memberof VehicleQueryResult
     * @static
     * @param {IVehicleQueryResult} message VehicleQueryResult message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    VehicleQueryResult.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a VehicleQueryResult message from the specified reader or buffer.
     * @function decode
     * @memberof VehicleQueryResult
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {VehicleQueryResult} VehicleQueryResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    VehicleQueryResult.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.VehicleQueryResult();
        while (reader.pos < end) {
            var tag = reader.uint32();
            if (tag === error)
                break;
            switch (tag >>> 3) {
            case 1: {
                    message.queryId = reader.string();
                    break;
                }
            case 2: {
                    message.timestamp = reader.string();
                    break;
                }
            case 3: {
                    message.vehicleId = reader.string();
                    break;
                }
            case 4: {
                    message.vehicleType = reader.string();
                    break;
                }
            case 5: {
                    message.gps = $root.GpsCoordinates.decode(reader, reader.uint32());
                    break;
                }
            case 6: {
                    message.direction = reader.string();
                    break;
                }
            case 7: {
                    message.speed = reader.double();
                    break;
                }
            case 8: {
                    message.geoHash = reader.string();
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a VehicleQueryResult message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof VehicleQueryResult
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {VehicleQueryResult} VehicleQueryResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    VehicleQueryResult.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a VehicleQueryResult message.
     * @function verify
     * @memberof VehicleQueryResult
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    VehicleQueryResult.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.queryId != null && message.hasOwnProperty("queryId"))
            if (!$util.isString(message.queryId))
                return "queryId: string expected";
        if (message.timestamp != null && message.hasOwnProperty("timestamp"))
            if (!$util.isString(message.timestamp))
                return "timestamp: string expected";
        if (message.vehicleId != null && message.hasOwnProperty("vehicleId"))
            if (!$util.isString(message.vehicleId))
                return "vehicleId: string expected";
        if (message.vehicleType != null && message.hasOwnProperty("vehicleType"))
            if (!$util.isString(message.vehicleType))
                return "vehicleType: string expected";
        if (message.gps != null && message.hasOwnProperty("gps")) {
            var error = $root.GpsCoordinates.verify(message.gps);
            if (error)
                return "gps." + error;
        }
        if (message.direction != null && message.hasOwnProperty("direction"))
            if (!$util.isString(message.direction))
                return "direction: string expected";
        if (message.speed != null && message.hasOwnProperty("speed"))
            if (typeof message.speed !== "number")
                return "speed: number expected";
        if (message.geoHash != null && message.hasOwnProperty("geoHash"))
            if (!$util.isString(message.geoHash))
                return "geoHash: string expected";
        return null;
    };

    /**
     * Creates a VehicleQueryResult message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof VehicleQueryResult
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {VehicleQueryResult} VehicleQueryResult
     */
    VehicleQueryResult.fromObject = function fromObject(object) {
        if (object instanceof $root.VehicleQueryResult)
            return object;
        var message = new $root.VehicleQueryResult();
        if (object.queryId != null)
            message.queryId = String(object.queryId);
        if (object.timestamp != null)
            message.timestamp = String(object.timestamp);
        if (object.vehicleId != null)
            message.vehicleId = String(object.vehicleId);
        if (object.vehicleType != null)
            message.vehicleType = String(object.vehicleType);
        if (object.gps != null) {
            if (typeof object.gps !== "object")
                throw TypeError(".VehicleQueryResult.gps: object expected");
            message.gps = $root.GpsCoordinates.fromObject(object.gps);
        }
        if (object.direction != null)
            message.direction = String(object.direction);
        if (object.speed != null)
            message.speed = Number(object.speed);
        if (object.geoHash != null)
            message.geoHash = String(object.geoHash);
        return message;
    };

    /**
     * Creates a plain object from a VehicleQueryResult message. Also converts values to other types if specified.
     * @function toObject
     * @memberof VehicleQueryResult
     * @static
     * @param {VehicleQueryResult} message VehicleQueryResult
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    VehicleQueryResult.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.queryId = "";
            object.timestamp = "";
            object.vehicleId = "";
            object.vehicleType = "";
            object.gps = null;
            object.direction = "";
            object.speed = 0;
            object.geoHash = "";
        }
        if (message.queryId != null && message.hasOwnProperty("queryId"))
            object.queryId = message.queryId;
        if (message.timestamp != null && message.hasOwnProperty("timestamp"))
            object.timestamp = message.timestamp;
        if (message.vehicleId != null && message.hasOwnProperty("vehicleId"))
            object.vehicleId = message.vehicleId;
        if (message.vehicleType != null && message.hasOwnProperty("vehicleType"))
            object.vehicleType = message.vehicleType;
        if (message.gps != null && message.hasOwnProperty("gps"))
            object.gps = $root.GpsCoordinates.toObject(message.gps, options);
        if (message.direction != null && message.hasOwnProperty("direction"))
            object.direction = message.direction;
        if (message.speed != null && message.hasOwnProperty("speed"))
            object.speed = options.json && !isFinite(message.speed) ? String(message.speed) : message.speed;
        if (message.geoHash != null && message.hasOwnProperty("geoHash"))
            object.geoHash = message.geoHash;
        return object;
    };

    /**
     * Converts this VehicleQueryResult to JSON.
     * @function toJSON
     * @memberof VehicleQueryResult
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    VehicleQueryResult.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for VehicleQueryResult
     * @function getTypeUrl
     * @memberof VehicleQueryResult
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    VehicleQueryResult.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/VehicleQueryResult";
    };

    return VehicleQueryResult;
})();

module.exports = $root;
