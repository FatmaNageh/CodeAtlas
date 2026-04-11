import { type Driver, driver as createDriver, auth } from "neo4j-driver";

type ClientConfig = {
  uri: string;
  username: string;
  password: string;
};

class Neo4jClient {
  private driver: Driver;

  constructor(cfg: ClientConfig) {
    this.driver = createDriver(cfg.uri, auth.basic(cfg.username, cfg.password));
  }

  session() {
    return this.driver.session();
  }

  async ping(): Promise<boolean> {
    const session = this.driver.session();
    try {
      await session.run("RETURN 1 as ok");
      return true;
    } finally {
      await session.close();
    }
  }

  async close() {
    await this.driver.close();
  }
}

let singleton: Neo4jClient | null = null;

export function getNeo4jClient(): Neo4jClient {
  if (singleton) return singleton;

  const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
  const username = process.env.NEO4J_USERNAME || "neo4j";
  const password = process.env.NEO4J_PASSWORD || "neo4j";

  singleton = new Neo4jClient({ uri, username, password });
  return singleton;
}
