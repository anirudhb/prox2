import "reflect-metadata";
import { Connection, createConnection, getConnectionManager, Repository } from "typeorm";
import { Confession } from "./models";

import { postgres_url } from "./secrets_wrapper";

async function getConnection(): Promise<Connection> {
  const connManager = getConnectionManager();
  if (connManager.has("default")) {
    await connManager.get().close();
  }

  return await createConnection({
    type: "postgres",
    url: postgres_url,
    entities: [Confession],
    synchronize: true,
    logging: false,
  });
}

export default async function getRepository(): Promise<Repository<Confession>> {
  return (await getConnection()).getRepository(Confession);
}
