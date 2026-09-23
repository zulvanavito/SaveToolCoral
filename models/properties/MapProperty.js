import { Property } from "./Property.js";
import { Serializer } from "../../utils/Serializer.js";

export class MapProperty extends Property {
  constructor() {
    super();
    this.Type = "MapProperty";
    this.KeyType = "";
    this.ValueType = "";
    this.ArrayIndex = 0;
    this.HasPropertyGuid = 0;
    this.NumKeysToRemove = 0;
    this.Entries = [];
    this.RawData = "";
  }

  get ValueSize() {
    if (this.RawData) {
      return Buffer.from(this.RawData, "base64").length;
    }
    return 0;
  }

  get TotalSize() {
    let size = this.Name.length + 4 + (this.Type.length + 4) + 4 + 4;
    let keyStr = this.KeyType.endsWith("\0")
      ? this.KeyType
      : this.KeyType + "\0";
    size += Buffer.byteLength(keyStr, "utf8") + 4;
    let valStr = this.ValueType.endsWith("\0")
      ? this.ValueType
      : this.ValueType + "\0";
    size += Buffer.byteLength(valStr, "utf8") + 4;
    size += 1;
    if (this.HasPropertyGuid === 1) size += 16;
    size += this.ValueSize;
    return size;
  }

  get Size() {
    return this.TotalSize;
  }

  deserialize(serial, size) {
    this.ArrayIndex = serial.readInt32();
    this.KeyType = serial.readString();
    this.ValueType = serial.readString();
    this.HasPropertyGuid = serial.readUInt8();
    if (this.HasPropertyGuid === 1) {
      this.PropertyGuid = serial.readBytes(16).toString("hex");
    }

    // Keep map payload as raw binary data by default to prevent corruption of nested complex structs/enums
    let rawBuf = serial.read(size);
    this.RawData = rawBuf.toString("base64");
    return this;
  }

  serialize() {
    let serial = Serializer.alloc(this.TotalSize);
    serial.writeString(this.Name);
    serial.writeString(this.Type);
    serial.writeInt32(this.ValueSize);
    serial.writeInt32(this.ArrayIndex);
    serial.writeString(this.KeyType);
    serial.writeString(this.ValueType);
    serial.writeUInt8(this.HasPropertyGuid);
    if (this.HasPropertyGuid === 1 && this.PropertyGuid) {
      serial.writeBytes(Buffer.from(this.PropertyGuid, "hex"));
    }

    if (this.RawData) {
      serial.writeBytes(Buffer.from(this.RawData, "base64"));
    }
    return serial.getWrittenBuffer();
  }

  static from(obj) {
    let prop = new MapProperty();
    prop.Name = obj.Name;
    prop.Type = obj.Type;
    prop.KeyType = obj.KeyType || "";
    prop.ValueType = obj.ValueType || "";
    prop.ArrayIndex = obj.ArrayIndex || 0;
    prop.HasPropertyGuid = obj.HasPropertyGuid || 0;
    prop.PropertyGuid = obj.PropertyGuid || null;
    prop.NumKeysToRemove = obj.NumKeysToRemove || 0;
    prop.Entries = obj.Entries || [];
    prop.RawData = obj.RawData || "";
    return prop;
  }
}
