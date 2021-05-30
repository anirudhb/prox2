import "reflect-metadata";
import { createConnection, Connection } from "typeorm";
import { Confession } from "./models";

export default async function getConnection(): Promise<Connection> {
  return await createConnection({
    type: "postgres",
    host: "FIXME",
    port: 9999,
    username: "FIXME",
    password: "FIXME",
    database: "FIXME",
    entities: [Confession],
    synchronize: true,
    logging: false,
  });
}
