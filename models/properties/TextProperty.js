import { Property } from "./Property.js";
import { Serializer } from "../../utils/Serializer.js";

export class TextProperty extends Property {
  constructor() {
    super();
    this.Type = "TextProperty";
    this.ArrayIndex = 0;
    this.HasPropertyGuid = 0;
    this.Flags = 0;
    this.HistoryType = 0;
    this.Namespace = "";
    this.Key = "";
    this.SourceString = "";
    this.RawData = "";
  }

  get ValueSize() {
    if (this.RawData) {
      return Buffer.from(this.RawData, "base64").length;
    }
    if (this.HistoryType === 0) {
      let size = 4 + 1; // Flags (4) + HistoryType (1)
      let ns = this.Namespace
        ? this.Namespace.endsWith("\0")
          ? this.Namespace
          : this.Namespace + "\0"
        : "";
      size += ns ? Buffer.byteLength(ns, "utf8") + 4 : 4;
      let key = this.Key
        ? this.Key.endsWith("\0")
          ? this.Key
          : this.Key + "\0"
        : "";
      size += key ? Buffer.byteLength(key, "utf8") + 4 : 4;
      let src = this.SourceString
        ? this.SourceString.endsWith("\0")
          ? this.SourceString
          : this.SourceString + "\0"
        : "";
      size += src ? Buffer.byteLength(src, "utf8") + 4 : 4;
      return size;
    }
    return 0;
  }

  get TotalSize() {
    let size = this.Name.length + 4 + (this.Type.length + 4) + 4 + 4 + 1;
    if (this.HasPropertyGuid === 1) size += 16;
    size += this.ValueSize;
    return size;
  }

  get Size() {
    return this.TotalSize;
  }

  deserialize(serial, size) {
    this.ArrayIndex = serial.readInt32();
    this.HasPropertyGuid = serial.readUInt8();
    if (this.HasPropertyGuid === 1) {
      this.PropertyGuid = serial.readBytes(16).toString("hex");
    }

    let startOffset = serial.tell;
    try {
      this.Flags = serial.readUInt32();
      this.HistoryType = serial.readInt8();
      if (this.HistoryType === 0) {
        this.Namespace = serial.readString();
        this.Key = serial.readString();
        this.SourceString = serial.readString();
        let readBytes = serial.tell - startOffset;
        if (readBytes !== size) {
          // Fallback to raw data if size does not match exact parse
          serial.tell = startOffset;
          this.RawData = serial.read(size).toString("base64");
        }
      } else {
        serial.tell = startOffset;
        this.RawData = serial.read(size).toString("base64");
      }
    } catch (e) {
      serial.tell = startOffset;
      this.RawData = serial.read(size).toString("base64");
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

    if (this.RawData) {
      serial.writeBytes(Buffer.from(this.RawData, "base64"));
    } else if (this.HistoryType === 0) {
      serial.writeUInt32(this.Flags);
      serial.writeInt8(this.HistoryType);
      serial.writeString(this.Namespace);
      serial.writeString(this.Key);
      serial.writeString(this.SourceString);
    }
    return serial.getWrittenBuffer();
  }

  static from(obj) {
    let prop = new TextProperty();
    prop.Name = obj.Name;
    prop.Type = obj.Type;
    prop.ArrayIndex = obj.ArrayIndex || 0;
    prop.HasPropertyGuid = obj.HasPropertyGuid || 0;
    prop.PropertyGuid = obj.PropertyGuid || null;
    prop.Flags = obj.Flags || 0;
    prop.HistoryType = obj.HistoryType || 0;
    prop.Namespace = obj.Namespace || "";
    prop.Key = obj.Key || "";
    prop.SourceString = obj.SourceString || "";
    prop.RawData = obj.RawData || "";
    return prop;
  }
}
