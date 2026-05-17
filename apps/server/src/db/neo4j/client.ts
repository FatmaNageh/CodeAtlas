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

  const rawUri = process.env.NEO4J_URI || "bolt://localhost:7687";
  const disableRouting = process.env.NEO4J_DISABLE_ROUTING === "true" || process.env.NEO4J_DISABLE_ROUTING === "1";
  const uri = disableRouting && rawUri.startsWith("neo4j://")
    ? `bolt://${rawUri.slice("neo4j://".length)}`
    : rawUri;
  const username = process.env.NEO4J_USERNAME || "neo4j";
  const password = process.env.NEO4J_PASSWORD || "neo4j";

  singleton = new Neo4jClient({ uri, username, password });
  return singleton;
}
