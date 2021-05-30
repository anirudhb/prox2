import "reflect-metadata";
import { createConnection, Repository } from "typeorm";
import { Confession } from "./models";

import { postgres_url } from "./secrets_wrapper";

export default async function getRepository(): Promise<Repository<Confession>> {
  return (await createConnection({
    type: "postgres",
    url: postgres_url,
    entities: [Confession],
    synchronize: true,
    logging: false,
  })).getRepository(Confession);
}
