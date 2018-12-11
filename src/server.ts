/**
 * Module dependencies.
 */
import * as bodyParser from "body-parser";
import * as compression from "compression"; // compresses requests
import * as dotenv from "dotenv";
import * as errorHandler from "errorhandler";
import * as express from "express";
import * as flash from "express-flash";
import * as session from "express-session";
import * as logger from "morgan";
import * as path from "path";
import expressValidator = require("express-validator");

import { createServer } from "http";
import * as ioGenerator from "socket.io";

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.config({ path: ".env.example" });

/**
 * Routes
 */
import accountRouter from "./routes/account";
import apiRouter from "./routes/api";
import contactRouter from "./routes/contact";
import oauthRouter from "./routes/oauth";
import rootRouter from "./routes/root";

/**
 * API keys and Passport configuration.
 */
import * as passportConfig from "./config/passport";
class App {
  // ref to Express instance
  public express: express.Application;

  constructor() {
    this.express = express();
    this.middleware();
    this.routes();
    this.launchConf();
  }
  private middleware(): void {
    this.express.set("port", process.env.PORT || 4000);
    this.express.set("views", path.join(__dirname, "../views"));
    this.express.set("view engine", "pug");
    this.express.use(compression());
    this.express.use(logger("dev"));
    this.express.use(bodyParser.json());
    this.express.use(bodyParser.urlencoded({ extended: true }));
    this.express.use(expressValidator());
    this.express.use(
      session({
        resave: true,
        saveUninitialized: true,
        secret: process.env.SESSION_SECRET,
      }),
    );
    this.express.use(flash());
    this.express.use((req, res, next) => {
      res.locals.user = req.user;
      next();
    });
    this.express.use((req, res, next) => {
      // After successful login, redirect back to the intended page
      if (
        !req.user &&
        req.path !== "/login" &&
        req.path !== "/signup" &&
        !req.path.match(/^\/auth/) &&
        !req.path.match(/\./)
      ) {
        req.session.returnTo = req.path;
      } else if (req.user && req.path === "/account") {
        req.session.returnTo = req.path;
      }
      next();
    });
    this.express.use(
      express.static(path.join(__dirname, "public"), { maxAge: 31557600000 }),
    );
  }
  /**
   * Primary app routes.
   */
  private routes(): void {
    this.express.use("/", rootRouter);
    this.express.use("/api", apiRouter);
    this.express.use("/auth", oauthRouter);
    this.express.use("/account", accountRouter);
    this.express.use("/contact", contactRouter);
  }

  private launchConf() {
    this.express.use(errorHandler());

    const http = createServer(this.express);
    const io = ioGenerator(http);

    io.on("connection", (socket) => {
      // tslint:disable-next-line:no-console
      console.log("a user connected");

      socket.on("disconnect", () => {
        // tslint:disable-next-line:no-console
        console.log("user disconnected");
      });

      socket.on("join", (room: string) => {
        // tslint:disable-next-line:no-console
        console.log("ASKED TO JOIN ROOM:", room);
        socket.join(room);

        setTimeout(() => {
          // tslint:disable-next-line:no-console
          console.log("EMITTING TO", room);
          io.to(room).emit("refresh");
        }, 5000);
      });

      socket.on("leave", (room: string) => {
        // tslint:disable-next-line:no-console
        console.log("ASKED TO LEAVE ROOM:", room);
        socket.leave(room);
      });
    });

    /**
     * Start Express server.
     */
    http.listen(this.express.get("port"), () => {
      // tslint:disable-next-line:no-console
      console.log(
        "  App is running at http://localhost:%d \
      in %s mode",
        this.express.get("port"),
        this.express.get("env"),
      );
      // tslint:disable-next-line:no-console
      console.log("  Press CTRL-C to stop\n");
    });
  }
}

export default new App().express;
