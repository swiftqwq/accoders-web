import * as TypeORM from "typeorm";
import Model from "./common";

@TypeORM.Entity()
export default class Record extends Model {
  @TypeORM.PrimaryGeneratedColumn()
  id: number;

  @TypeORM.Column({nullable:true})
  user_id:number;

  @TypeORM.Column({ type: "varchar", length: 50 })
  type: string;

  @TypeORM.Column({ type: "varchar", length: 50 })
  data: string;
}
