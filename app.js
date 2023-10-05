//Importing Modules

const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jsonwebtoken = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");

const app = express();

app.use(express.json());

let db = null;

//initializing Database And Server
const initializeDatabaseAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3001, () => {
      console.log("Server Running Successfully At http://localhost:3001/");
    });
  } catch (error) {
    console.log(`DB ERROR ${error.message}`);
    process.exit(1);
  }
};

initializeDatabaseAndServer();

//Authentication Middle wear

const authenticationToken = (request, response, nest) => {
  let jsonWebToken;
  const authHeader = request.headers["Authorization"];
  if (authHeader !== undefined) {
    jsonWebToken = authHeader.split(" ")[1];
  }

  if (jsonWebToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jsonwebtoken.verify(
      jsonWebToken,
      "MY_SECRET_TOKEN",
      async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          next();
        }
      }
    );
  }
};

// API 1 Register

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  //Checking Whether The user Exists

  const QueryToObtainUser = `SELECT * FROM user WHERE username='${username}';`;

  const runTheQuery = await db.get(QueryToObtainUser);

  //Scenario 1
  if (runTheQuery === undefined) {
    if (password.length > 5) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const queryToCreateUser = `INSERT INTO user (username, password, name, gender)
      VALUES(
          '${username}',
          '${hashedPassword}',
          '${name}',
          '${gender}'
      );`;

      const responseResult = await db.run(queryToCreateUser);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2 login

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const findingUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const getResult = await db.get(findingUserQuery);

  if (getResult === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      getResult.password
    );
    if (isPasswordMatched === true) {
      const jwtToken = jsonwebtoken.sign(getResult, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

module.exports = app;
