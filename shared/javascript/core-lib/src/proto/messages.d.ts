import * as $protobuf from "protobufjs";
import Long = require("long");
/** Properties of a ServiceIdentity. */
export interface IServiceIdentity {

    /** ServiceIdentity name */
    name?: (string|null);

    /** ServiceIdentity instance */
    instance?: (number|null);
}

/** Represents a ServiceIdentity. */
export class ServiceIdentity implements IServiceIdentity {

    /**
     * Constructs a new ServiceIdentity.
     * @param [properties] Properties to set
     */
    constructor(properties?: IServiceIdentity);

    /** ServiceIdentity name. */
    public name: string;

    /** ServiceIdentity instance. */
    public instance: number;

    /**
     * Creates a new ServiceIdentity instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ServiceIdentity instance
     */
    public static create(properties?: IServiceIdentity): ServiceIdentity;

    /**
     * Encodes the specified ServiceIdentity message. Does not implicitly {@link ServiceIdentity.verify|verify} messages.
     * @param message ServiceIdentity message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IServiceIdentity, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ServiceIdentity message, length delimited. Does not implicitly {@link ServiceIdentity.verify|verify} messages.
     * @param message ServiceIdentity message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IServiceIdentity, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ServiceIdentity message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ServiceIdentity
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ServiceIdentity;

    /**
     * Decodes a ServiceIdentity message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ServiceIdentity
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ServiceIdentity;

    /**
     * Verifies a ServiceIdentity message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a ServiceIdentity message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ServiceIdentity
     */
    public static fromObject(object: { [k: string]: any }): ServiceIdentity;

    /**
     * Creates a plain object from a ServiceIdentity message. Also converts values to other types if specified.
     * @param message ServiceIdentity
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ServiceIdentity, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ServiceIdentity to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ServiceIdentity
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a GpsCoordinates. */
export interface IGpsCoordinates {

    /** GpsCoordinates lat */
    lat?: (number|null);

    /** GpsCoordinates lon */
    lon?: (number|null);

    /** GpsCoordinates alt */
    alt?: (number|null);
}

/** Represents a GpsCoordinates. */
export class GpsCoordinates implements IGpsCoordinates {

    /**
     * Constructs a new GpsCoordinates.
     * @param [properties] Properties to set
     */
    constructor(properties?: IGpsCoordinates);

    /** GpsCoordinates lat. */
    public lat: number;

    /** GpsCoordinates lon. */
    public lon: number;

    /** GpsCoordinates alt. */
    public alt: number;

    /**
     * Creates a new GpsCoordinates instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GpsCoordinates instance
     */
    public static create(properties?: IGpsCoordinates): GpsCoordinates;

    /**
     * Encodes the specified GpsCoordinates message. Does not implicitly {@link GpsCoordinates.verify|verify} messages.
     * @param message GpsCoordinates message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IGpsCoordinates, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified GpsCoordinates message, length delimited. Does not implicitly {@link GpsCoordinates.verify|verify} messages.
     * @param message GpsCoordinates message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IGpsCoordinates, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a GpsCoordinates message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GpsCoordinates
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): GpsCoordinates;

    /**
     * Decodes a GpsCoordinates message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GpsCoordinates
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): GpsCoordinates;

    /**
     * Verifies a GpsCoordinates message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a GpsCoordinates message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GpsCoordinates
     */
    public static fromObject(object: { [k: string]: any }): GpsCoordinates;

    /**
     * Creates a plain object from a GpsCoordinates message. Also converts values to other types if specified.
     * @param message GpsCoordinates
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: GpsCoordinates, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this GpsCoordinates to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GpsCoordinates
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a MessageTracking. */
export interface IMessageTracking {

    /** MessageTracking sequence */
    sequence?: (number|null);

    /** MessageTracking emitter */
    emitter?: (IServiceIdentity|null);
}

/** Represents a MessageTracking. */
export class MessageTracking implements IMessageTracking {

    /**
     * Constructs a new MessageTracking.
     * @param [properties] Properties to set
     */
    constructor(properties?: IMessageTracking);

    /** MessageTracking sequence. */
    public sequence: number;

    /** MessageTracking emitter. */
    public emitter?: (IServiceIdentity|null);

    /**
     * Creates a new MessageTracking instance using the specified properties.
     * @param [properties] Properties to set
     * @returns MessageTracking instance
     */
    public static create(properties?: IMessageTracking): MessageTracking;

    /**
     * Encodes the specified MessageTracking message. Does not implicitly {@link MessageTracking.verify|verify} messages.
     * @param message MessageTracking message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IMessageTracking, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified MessageTracking message, length delimited. Does not implicitly {@link MessageTracking.verify|verify} messages.
     * @param message MessageTracking message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IMessageTracking, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a MessageTracking message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns MessageTracking
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MessageTracking;

    /**
     * Decodes a MessageTracking message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns MessageTracking
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MessageTracking;

    /**
     * Verifies a MessageTracking message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a MessageTracking message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns MessageTracking
     */
    public static fromObject(object: { [k: string]: any }): MessageTracking;

    /**
     * Creates a plain object from a MessageTracking message. Also converts values to other types if specified.
     * @param message MessageTracking
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: MessageTracking, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this MessageTracking to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for MessageTracking
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a MoveCommand. */
export interface IMoveCommand {

    /** MoveCommand vehicleId */
    vehicleId?: (string|null);

    /** MoveCommand vehicleType */
    vehicleType?: (string|null);

    /** MoveCommand zoneId */
    zoneId?: (string|null);

    /** MoveCommand direction */
    direction?: (string|null);

    /** MoveCommand speed */
    speed?: (number|null);

    /** MoveCommand gps */
    gps?: (IGpsCoordinates|null);

    /** MoveCommand timestamp */
    timestamp?: (string|null);

    /** MoveCommand tracking */
    tracking?: (IMessageTracking|null);
}

/** Represents a MoveCommand. */
export class MoveCommand implements IMoveCommand {

    /**
     * Constructs a new MoveCommand.
     * @param [properties] Properties to set
     */
    constructor(properties?: IMoveCommand);

    /** MoveCommand vehicleId. */
    public vehicleId: string;

    /** MoveCommand vehicleType. */
    public vehicleType: string;

    /** MoveCommand zoneId. */
    public zoneId: string;

    /** MoveCommand direction. */
    public direction: string;

    /** MoveCommand speed. */
    public speed: number;

    /** MoveCommand gps. */
    public gps?: (IGpsCoordinates|null);

    /** MoveCommand timestamp. */
    public timestamp: string;

    /** MoveCommand tracking. */
    public tracking?: (IMessageTracking|null);

    /**
     * Creates a new MoveCommand instance using the specified properties.
     * @param [properties] Properties to set
     * @returns MoveCommand instance
     */
    public static create(properties?: IMoveCommand): MoveCommand;

    /**
     * Encodes the specified MoveCommand message. Does not implicitly {@link MoveCommand.verify|verify} messages.
     * @param message MoveCommand message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IMoveCommand, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified MoveCommand message, length delimited. Does not implicitly {@link MoveCommand.verify|verify} messages.
     * @param message MoveCommand message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IMoveCommand, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a MoveCommand message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns MoveCommand
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MoveCommand;

    /**
     * Decodes a MoveCommand message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns MoveCommand
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MoveCommand;

    /**
     * Verifies a MoveCommand message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a MoveCommand message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns MoveCommand
     */
    public static fromObject(object: { [k: string]: any }): MoveCommand;

    /**
     * Creates a plain object from a MoveCommand message. Also converts values to other types if specified.
     * @param message MoveCommand
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: MoveCommand, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this MoveCommand to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for MoveCommand
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of an EnrichedMoveCommand. */
export interface IEnrichedMoveCommand {

    /** EnrichedMoveCommand command */
    command?: (IMoveCommand|null);

    /** EnrichedMoveCommand collectorIndex */
    collectorIndex?: (number|null);

    /** EnrichedMoveCommand geoHash */
    geoHash?: (string|null);

    /** EnrichedMoveCommand partitionKey */
    partitionKey?: (string|null);
}

/** Represents an EnrichedMoveCommand. */
export class EnrichedMoveCommand implements IEnrichedMoveCommand {

    /**
     * Constructs a new EnrichedMoveCommand.
     * @param [properties] Properties to set
     */
    constructor(properties?: IEnrichedMoveCommand);

    /** EnrichedMoveCommand command. */
    public command?: (IMoveCommand|null);

    /** EnrichedMoveCommand collectorIndex. */
    public collectorIndex: number;

    /** EnrichedMoveCommand geoHash. */
    public geoHash: string;

    /** EnrichedMoveCommand partitionKey. */
    public partitionKey: string;

    /**
     * Creates a new EnrichedMoveCommand instance using the specified properties.
     * @param [properties] Properties to set
     * @returns EnrichedMoveCommand instance
     */
    public static create(properties?: IEnrichedMoveCommand): EnrichedMoveCommand;

    /**
     * Encodes the specified EnrichedMoveCommand message. Does not implicitly {@link EnrichedMoveCommand.verify|verify} messages.
     * @param message EnrichedMoveCommand message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IEnrichedMoveCommand, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified EnrichedMoveCommand message, length delimited. Does not implicitly {@link EnrichedMoveCommand.verify|verify} messages.
     * @param message EnrichedMoveCommand message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IEnrichedMoveCommand, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes an EnrichedMoveCommand message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns EnrichedMoveCommand
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): EnrichedMoveCommand;

    /**
     * Decodes an EnrichedMoveCommand message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns EnrichedMoveCommand
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): EnrichedMoveCommand;

    /**
     * Verifies an EnrichedMoveCommand message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates an EnrichedMoveCommand message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns EnrichedMoveCommand
     */
    public static fromObject(object: { [k: string]: any }): EnrichedMoveCommand;

    /**
     * Creates a plain object from an EnrichedMoveCommand message. Also converts values to other types if specified.
     * @param message EnrichedMoveCommand
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: EnrichedMoveCommand, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this EnrichedMoveCommand to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for EnrichedMoveCommand
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}

/** Properties of a VehicleQueryResult. */
export interface IVehicleQueryResult {

    /** VehicleQueryResult queryId */
    queryId?: (string|null);

    /** VehicleQueryResult timestamp */
    timestamp?: (string|null);

    /** VehicleQueryResult vehicleId */
    vehicleId?: (string|null);

    /** VehicleQueryResult vehicleType */
    vehicleType?: (string|null);

    /** VehicleQueryResult gps */
    gps?: (IGpsCoordinates|null);

    /** VehicleQueryResult direction */
    direction?: (string|null);

    /** VehicleQueryResult speed */
    speed?: (number|null);

    /** VehicleQueryResult geoHash */
    geoHash?: (string|null);
}

/** Represents a VehicleQueryResult. */
export class VehicleQueryResult implements IVehicleQueryResult {

    /**
     * Constructs a new VehicleQueryResult.
     * @param [properties] Properties to set
     */
    constructor(properties?: IVehicleQueryResult);

    /** VehicleQueryResult queryId. */
    public queryId: string;

    /** VehicleQueryResult timestamp. */
    public timestamp: string;

    /** VehicleQueryResult vehicleId. */
    public vehicleId: string;

    /** VehicleQueryResult vehicleType. */
    public vehicleType: string;

    /** VehicleQueryResult gps. */
    public gps?: (IGpsCoordinates|null);

    /** VehicleQueryResult direction. */
    public direction: string;

    /** VehicleQueryResult speed. */
    public speed: number;

    /** VehicleQueryResult geoHash. */
    public geoHash: string;

    /**
     * Creates a new VehicleQueryResult instance using the specified properties.
     * @param [properties] Properties to set
     * @returns VehicleQueryResult instance
     */
    public static create(properties?: IVehicleQueryResult): VehicleQueryResult;

    /**
     * Encodes the specified VehicleQueryResult message. Does not implicitly {@link VehicleQueryResult.verify|verify} messages.
     * @param message VehicleQueryResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IVehicleQueryResult, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified VehicleQueryResult message, length delimited. Does not implicitly {@link VehicleQueryResult.verify|verify} messages.
     * @param message VehicleQueryResult message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IVehicleQueryResult, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a VehicleQueryResult message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns VehicleQueryResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): VehicleQueryResult;

    /**
     * Decodes a VehicleQueryResult message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns VehicleQueryResult
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): VehicleQueryResult;

    /**
     * Verifies a VehicleQueryResult message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a VehicleQueryResult message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns VehicleQueryResult
     */
    public static fromObject(object: { [k: string]: any }): VehicleQueryResult;

    /**
     * Creates a plain object from a VehicleQueryResult message. Also converts values to other types if specified.
     * @param message VehicleQueryResult
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: VehicleQueryResult, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this VehicleQueryResult to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for VehicleQueryResult
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
}
