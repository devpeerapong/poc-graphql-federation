import {
  Booking,
  BookingConnection,
  UserBookingConnectionArgs,
} from "./generated";

declare module "./generated" {
  interface Booking {
    createdAt?: Date;
  }

  interface BookingConnection {
    __args?: UserBookingConnectionArgs;
  }
}
