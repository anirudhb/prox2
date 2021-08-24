import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class Confession {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  approved?: boolean;
  @Column()
  viewed?: boolean;

  @Column("text")
  text!: string;
  @Column("tw_text")
  tw_text?: string;

  @Column()
  staging_ts?: string;
  @Column()
  published_ts?: string;

  @Column()
  uid_salt!: string;
  @Column()
  uid_hash!: string;
}
