import * as TypeORM from "typeorm";
import Model from "./common";

@TypeORM.Entity()
export default class Judger extends Model {
    @TypeORM.PrimaryColumn({ type: "varchar", length: 50 })
    id: string;

    @TypeORM.Column({ type: "boolean", default: false })
    is_online: boolean;
}
