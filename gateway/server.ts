import { config } from "dotenv";
config();

import { ApolloServer } from "apollo-server";
import { ApolloGateway, RemoteGraphQLDataSource } from "@apollo/gateway";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  willSendRequest({ request, context }) {
    request.http.headers.set("x-auth-token", process.env.AUTH_TOKEN);
    request.http.headers.set("x-user-id", context.userId);
  }
}

const gateway = new ApolloGateway({
  __exposeQueryPlanExperimental: true,
  supergraphSdl: readFileSync("./gateway/schema.graphql", "utf-8"),
  buildService: ({ url }) => {
    return new AuthenticatedDataSource({ url });
  },
});

const server = new ApolloServer({
  gateway,
  context: async ({ req }) => {
    const first = await prisma.token.findFirst({
      where: { id: req.header("authorization"), voidAt: null },
    });

    return { userId: first?.userId };
  },
  plugins: [require("apollo-tracing").plugin()],
});

server.listen(4000).then(({ url }) => console.log(`Gateway ready at ${url}`));

process.on("SIGINT", () => {
  server.stop();
});
