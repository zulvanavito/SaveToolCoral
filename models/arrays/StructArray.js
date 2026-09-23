import { StructProperty } from "../properties/StructProperty.js";
import { PropertyFactory } from "../factories/PropertyFactory.js";

export class StructArray extends StructProperty {
  deserialize(serial, count) {
    this.Name = serial.readString();
    this.Type = serial.readString();
    let Size = serial.readInt32();
    this.ArrayIndex = serial.readInt32();
    this.StoredPropertyType = serial.readString();
    this.StructGuid = serial.readBytes(16).toString("hex");
    this.HasPropertyGuid = serial.readUInt8();
    let i = 0;
    this.Properties = [];
    while (i < count) {
      let Name = this.StoredPropertyType;
      let Type = "Tuple";
      let prop = PropertyFactory.create({ Name, Type });
      prop.deserialize(serial);
      this.Properties.push(prop);
      i++;
    }
    return this;
  }
  static from(obj) {
    let struct = new StructArray();
    struct.Name = obj.Name;
    struct.Type = obj.Type;
    struct.StoredPropertyType = obj.StoredPropertyType;
    struct.Properties = [];
    if (obj.Properties !== undefined)
      obj.Properties.forEach((prop) =>
        struct.Properties.push(PropertyFactory.create(prop)),
      );
    return struct;
  }
}
