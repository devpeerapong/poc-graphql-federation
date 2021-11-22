import { gql, ApolloServer } from "apollo-server";
import { buildFederatedSchema } from "@apollo/federation";
import { readFileSync } from "fs";
import { Resolvers } from "./generated";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const typeDefs = gql`
  ${readFileSync("./health/health.graphql", "utf-8")}
`;

const resolvers: Resolvers = {
  User: {
    async healthInformation({ id }) {
      return await prisma.healthInformation.findUnique({
        where: { userId: id },
      });
    },
  },
  Mutation: {
    async updateHealthInformation(parent, { input }, { userId }) {
      const healthInformation = await prisma.healthInformation.upsert({
        where: { userId },
        create: { userId, height: input.height, weight: input.weight },
        update: { height: input.height, weight: input.weight },
      });

      return {
        id: userId,
        healthInformation,
      };
    },
  },
};

const server = new ApolloServer({
  schema: buildFederatedSchema([{ typeDefs, resolvers }]),
  context: ({ req }) => ({
    userId:
      req.header("x-auth-token") === process.env.AUTH_TOKEN &&
      req.header("x-user-id"),
  }),
});

server.listen(4002).then(({ url }) => {
  console.log(`Health service ready at ${url}`);
});

process.on("SIGINT", () => {
  server.stop();
});
