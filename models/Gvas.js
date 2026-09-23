import { PropertyFactory } from "./factories/PropertyFactory.js";
import { SerializationError } from "./PropertyErrors.js";
import { GvasHeader } from "./GvasHeader.js";
import { Tuple } from "./properties/Tuple.js";
import { Serializer } from "../utils/Serializer.js";
import { CoralCompressor } from "../utils/CoralCompressor.js";

export class Gvas {
  constructor() {
    this.Header = new GvasHeader();
    this.Properties = new Tuple();
    this.CoralCompressed = false;
    this.OuterMetadata = null;
  }

  get Size() {
    let size = this.Header.Size;
    size += this.Properties.Size;
    size += 4; // 4-byte 00000000 EOF marker
    return size;
  }

  deserialize(serial) {
    let format = serial.read(4);
    if (Buffer.compare(Buffer.from("GVAS"), format) !== 0) {
      throw new Error(`Unexpected header, expected 'GVAS'`);
    }

    this.Header.deserialize(serial);
    this.Properties.Name = this.Header.SaveGameType;
    this.Properties.deserialize(serial);
    return this;
  }

  serialize() {
    let serial = Serializer.alloc(this.Size);
    serial.write(this.Header.serialize());
    serial.write(this.Properties.serialize());
    serial.writeInt32(0); // 4-byte EOF marker
    return serial.getWrittenBuffer();
  }

  deserializeFromBuffer(buf) {
    if (CoralCompressor.isCoralCompressed(buf)) {
      let { innerBuffer, outerMetadata } = CoralCompressor.decompress(buf);
      this.CoralCompressed = true;
      this.OuterMetadata = outerMetadata;
      let serial = new Serializer(innerBuffer);
      this.deserialize(serial);
    } else {
      this.CoralCompressed = false;
      this.OuterMetadata = null;
      let serial = new Serializer(buf);
      this.deserialize(serial);
    }
    return this;
  }

  serializeToBuffer() {
    let innerBuf = this.serialize();
    if (this.CoralCompressed) {
      return CoralCompressor.compress(innerBuf, this.OuterMetadata);
    }
    return innerBuf;
  }

  static from(obj) {
    let gvas = new Gvas();
    gvas.CoralCompressed = obj.CoralCompressed || false;
    gvas.OuterMetadata = obj.OuterMetadata || null;
    gvas.Header = GvasHeader.from(obj.Header);
    gvas.Properties = PropertyFactory.create(obj.Properties);
    return gvas;
  }
}
