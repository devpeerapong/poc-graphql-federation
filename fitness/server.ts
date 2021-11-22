import { config } from "dotenv";
config();

import { gql, ApolloServer } from "apollo-server";
import { buildFederatedSchema } from "@apollo/federation";
import { readFileSync } from "fs";
import { Booking, Resolvers } from "./generated";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const typeDefs = gql`
  ${readFileSync("./fitness/fitness.graphql")}
`;

const resolvers: Resolvers = {
  Mutation: {
    async bookSchedule(parent, { input }, { userId }) {
      const booking = await prisma.booking.findFirst({
        where: { userId, scheduleId: input.scheduleId },
      });

      if (booking) {
        throw new Error("Already booked");
      }

      const schedule = await prisma.schedule.findUnique({
        where: { id: input.scheduleId },
      });
      const result = await prisma.booking.create({
        data: {
          dateTime: schedule.dateTime,
          scheduleId: input.scheduleId,
          userId,
        },
      });

      return {
        id: result.id,
        dateTime: result.dateTime.toISOString(),
        createdAt: result.createdAt,
        schedule: { id: result.scheduleId } as any,
        user: { id: userId } as any,
      };
    },
  },
  Query: {
    async schedules() {
      const result = await prisma.schedule.findMany();

      return result.map((item) => ({
        id: item.id,
        title: item.title,
        dateTime: item.dateTime.toISOString(),
      }));
    },
  },
  User: {
    async bookingConnection({ id: userId }, { after, first = 10 }) {
      const cursor = after && bookingAfterCursor(after);

      const bookings = await prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        where: !cursor
          ? undefined
          : { id: { not: cursor.id }, createdAt: { lte: cursor.createdAt } },
      });

      return {
        __args: { after, first },
        totalCount: null as any,
        pageInfo: null as any,
        edges: bookings.map((booking) => {
          const node = {
            id: booking.id,
            dateTime: booking.dateTime.toISOString(),
            createdAt: booking.createdAt,
            schedule: { id: booking.scheduleId } as any,
            user: { id: booking.userId } as any,
          };

          return {
            node,
            cursor: encodeBookingCursor(node),
          };
        }),
      };
    },
  },
  BookingConnection: {
    async pageInfo({ __args = {}, edges }, args, { userId }) {
      const { first, after } = __args;

      const start = edges[0];
      const end = edges[edges.length - 1];
      const startCursor = start?.cursor;
      const endCursor = end?.cursor;

      const hasNextPage =
        edges.length === first &&
        Boolean(
          await prisma.booking.findFirst({
            take: 1,
            where: {
              id: { not: userId },
              createdAt: { lte: end.node.createdAt },
            },
            orderBy: { createdAt: "desc" },
          })
        );

      const hasPreviousPage = Boolean(
        after &&
          Boolean(
            await prisma.booking.findFirst({
              take: 1,
              where: {
                id: { not: userId },
                createdAt: { gte: end.node.createdAt },
              },
              orderBy: { createdAt: "desc" },
            })
          )
      );

      return {
        hasNextPage,
        hasPreviousPage,
        startCursor,
        endCursor,
      };
    },
    async totalCount(parent, args, { userId }) {
      return prisma.booking.count({ where: { userId } });
    },
  },
  Booking: {
    async schedule({ schedule }: Booking) {
      const result = await prisma.schedule.findUnique({
        where: { id: schedule.id },
      });

      return {
        id: result.id,
        title: result.title,
        dateTime: result.dateTime.toISOString(),
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

server.listen(4003).then(({ url }) => {
  console.log(`Fitness service ready at ${url}`);
});

process.on("SIGINT", () => {
  server.stop();
});

function encodeBookingCursor(booking: Booking & { createdAt: Date }) {
  return Buffer.from(
    JSON.stringify({
      id: booking.id,
      createdAt: booking.createdAt.toISOString(),
    })
  ).toString("base64");
}

function bookingAfterCursor(
  after: string
): { id: string; createdAt: Date } | null {
  const json = Buffer.from(after, "base64").toString("utf-8");

  try {
    const cursor = JSON.parse(json);

    if (!cursor.id || !cursor.createdAt) return null;

    const createdAt = new Date(cursor.createdAt);

    if (Number.isNaN(createdAt)) return null;

    return { id: cursor.id, createdAt };
  } catch (error) {
    return null;
  }
}
