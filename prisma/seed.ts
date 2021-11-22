import { PrismaClient, Schedule, User } from "@prisma/client";

const prisma = new PrismaClient();

const schedules: Omit<Schedule, "id" | "createdAt">[] = [
  {
    title: "2021-6-1",
    dateTime: new Date(2021, 5, 1),
  },
  {
    title: "2021-6-3",
    dateTime: new Date(2021, 5, 3),
  },
  {
    title: "2021-6-5",
    dateTime: new Date(2021, 5, 5),
  },
];

const users: Omit<User, "id">[] = [
  {
    username: "field",
    password: "$2b$10$2nIiLD7MJM08vW9CZh0jjO.T1w4WZTX/HZg4DCFH59Pf35DTx3awu",
    name: "Field",
  },
];

(async () => {
  for (const data of schedules) {
    await prisma.schedule.create({ data });
  }

  for (const data of users) {
    await prisma.user.create({ data });
  }

  await prisma.$disconnect();
})();
