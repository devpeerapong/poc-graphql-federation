import { config } from "dotenv";
config();

import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import { gql, ApolloServer } from "apollo-server";
import { buildFederatedSchema } from "@apollo/federation";
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { Resolvers } from "./generated";

const prisma = new PrismaClient();

const typeDefs = gql`
  ${readFileSync("./idp/idp.graphql", "utf-8")}
`;

const resolvers: Resolvers = {
  User: {
    async __resolveReference({ id }) {
      const user = await prisma.user.findUnique({ where: { id } });

      return {
        id: user.id,
        username: user.username,
        profile: {
          name: user.name,
        },
      };
    },
  },
  Query: {
    async me(parent, args, { user }) {
      return user;
    },
  },
  Mutation: {
    async logout(parent, args, { token }) {
      const result = await prisma.token.update({
        where: { id: token },
        data: { voidAt: new Date() },
      });

      return "Success";
    },
    async accessToken(_, { input }) {
      const { username, password } = input;

      const user = await prisma.user.findUnique({ where: { username } });

      if (!(await bcrypt.compare(password, user.password))) {
        throw new Error("401");
      }

      const accessToken = nanoid(24);
      await prisma.token.create({ data: { id: accessToken, userId: user.id } });

      return accessToken;
    },
    async register(_, { input }) {
      const { username, password } = input;
      const accessToken = nanoid(24);
      const user = await prisma.user.create({
        data: {
          username,
          password: bcrypt.hashSync(password, 10),
          name: username.substr(0, 1).toUpperCase() + username.substr(1),
          tokens: { create: [{ id: accessToken }] },
        },
      });

      return {
        accessToken,
        user: {
          id: user.id,
          username,
          profile: { name: user.name },
        },
      };
    },
    async updateProfile(parent, { input }, { user }) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { name: input.name },
      });

      return {
        id: updated.id,
        username: updated.username,
        profile: {
          name: updated.name,
        },
      };
    },
  },
};

const server = new ApolloServer({
  schema: buildFederatedSchema([{ typeDefs, resolvers }]),
  context: async ({ req }) => {
    const authToken = req.header("x-auth-token");
    const userId = req.header("x-user-id");

    if (authToken !== process.env.AUTH_TOKEN) {
      return {};
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    return {
      user: {
        id: user.id,
        username: user.username,
        profile: { name: user.name },
      },
    };
  },
});

server.listen(4001).then(({ url }) => {
  console.log(`IDP service ready at ${url}`);
});

process.on("SIGINT", () => {
  server.stop();
});
