import { Property } from "./Property.js";
import { Serializer } from "../../utils/Serializer.js";

export class UnknownProperty extends Property {
  constructor() {
    super();
    this.Type = "UnknownProperty";
    this.DataSize = 0;
    this.ArrayIndex = 0;
    this.HasPropertyGuid = 0;
    this.PropertyGuid = null;
    this.TagMetadata = "";
    this.RawData = "";
  }

  get ValueSize() {
    if (this.RawData) {
      return Buffer.from(this.RawData, "base64").length;
    }
    return this.DataSize;
  }

  get TotalSize() {
    let size = this.Name.length + 4 + (this.Type.length + 4) + 4 + 4 + 1;
    if (this.HasPropertyGuid === 1) {
      size += 16;
    }
    if (this.TagMetadata) {
      size += Buffer.from(this.TagMetadata, "base64").length;
    }
    size += this.ValueSize;
    return size;
  }

  get Size() {
    return this.TotalSize;
  }

  set Size(val) {
    this.DataSize = val;
  }

  deserialize(serial, size) {
    this.DataSize = size;
    this.ArrayIndex = serial.readInt32();
    this.HasPropertyGuid = serial.readUInt8();
    if (this.HasPropertyGuid === 1) {
      this.PropertyGuid = serial.readBytes(16).toString("hex");
    }
    if (size > 0) {
      let rawBuf = serial.read(size);
      this.RawData = rawBuf.toString("base64");
    } else {
      this.RawData = "";
    }
    return this;
  }

  serialize() {
    let serial = Serializer.alloc(this.TotalSize);
    serial.writeString(this.Name);
    serial.writeString(this.Type);
    serial.writeInt32(this.ValueSize);
    serial.writeInt32(this.ArrayIndex);
    serial.writeUInt8(this.HasPropertyGuid);
    if (this.HasPropertyGuid === 1 && this.PropertyGuid) {
      serial.writeBytes(Buffer.from(this.PropertyGuid, "hex"));
    }
    if (this.TagMetadata) {
      serial.writeBytes(Buffer.from(this.TagMetadata, "base64"));
    }
    if (this.RawData) {
      serial.writeBytes(Buffer.from(this.RawData, "base64"));
    }
    return serial.getWrittenBuffer();
  }

  static from(obj) {
    let prop = new UnknownProperty();
    prop.Name = obj.Name;
    prop.Type = obj.Type;
    prop.DataSize = obj.DataSize || obj.Size || 0;
    prop.ArrayIndex = obj.ArrayIndex || 0;
    prop.HasPropertyGuid = obj.HasPropertyGuid || 0;
    prop.PropertyGuid = obj.PropertyGuid || null;
    prop.TagMetadata = obj.TagMetadata || "";
    prop.RawData = obj.RawData || "";
    return prop;
  }
}
