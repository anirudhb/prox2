import { NextApiRequest, NextApiResponse } from "next";
import { fetchRecords } from "../../lib/main";
import getRepository from "../../lib/db";
import { api_secret } from "../../lib/secrets_wrapper";

const SECRET_TOKEN = api_secret;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const authToken = req.headers.authorization;

  if (authToken !== `Bearer ${SECRET_TOKEN}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  console.log("Request authorized!")
  const repo = await getRepository();
  await fetchRecords(repo);
  res.writeHead(200).end();
}
