const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const jsonwebtoken = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "twitterClone.db");
const app = express();

app.use(express.json());

let db = "";

const initializeDatabaseAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () => {
      console.log("Server running Successfully at http://localhost:3001/");
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
    process.exit(1);
  }
};

initializeDatabaseAndServer();

const convertResponseObjectUser = (dbObject) => {
  return {
    userId: dbObject.user_id,
    username: dbObject.username,
    password: dbObject.password,
    name: dbObject.name,
    gender: dbObject.gender,
  };
};

const Authentication = (request, response, next) => {
  let jwtTokenCheck;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtTokenCheck = authHeader.split(" ")[1];
  }

  if (jwtTokenCheck === undefined) {
    response.status(400);
    // If the JWT token is not provided by the user or an invalid JWT token is provided
    response.send("Invalid JWT Token");
  } else {
    jsonwebtoken.verify(
      jwtTokenCheck,
      "MY_SECRET_KEY",
      async (error, payload) => {
        if (error) {
          response.status(400);
          //If the JWT token is not provided by the user or an invalid JWT token is provided
          response.send("Invalid JWT Token");
        } else {
          next(); //After successful verification of JWT token, proceed to next middleware or handler
        }
      }
    );
  }
};

//API one

app.post("/register/", async (request, response) => {
  const { userId } = request.params;
  const { username, password, name, gender } = request.body;
  const fetchUserExistQuery = `SELECT * FROM user WHERE username='${username}';`;
  const userFetchQueryResponse = await db.get(fetchUserExistQuery);

  if (userFetchQueryResponse === undefined) {
    //If the registrant provides a password with less than 6 characters
    if (password.length > 5) {
      const hashPassword = await bcrypt.hash(password, 10);

      const registerWithUserQuery = `INSERT INTO user (username,password,name,gender)
      
      VALUES(
            '${username}',
            '${hashPassword}',
            '${name}',
            '${gender}'

      );`;
      const registerResponse = await db.run(registerWithUserQuery);
      //Successful registration of the registrant
      response.status(400);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    // if user already exists
    response.status(400);

    response.send("User already exists");
  }
});

// API 2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const fetchUserExistQuery = `SELECT * FROM user WHERE username='${username}';`;
  const userFetchQueryResponse = await db.get(fetchUserExistQuery);
  const userLogin = convertResponseObjectUser(userFetchQueryResponse);
  if (userLogin.username !== undefined) {
    const payLoad = userLogin.username;
    const checkHashedPassword = await bcrypt.compare(
      password,
      userLogin.password
    );
    if (checkHashedPassword === true) {
      //Successful login of the user
      const jwtToken = jsonwebtoken.sign(payLoad, "MY_SECRET_KEY");
      response.send({ jwtToken }); //Return the JWT Token
    } else {
      //If the user provides an incorrect password
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    //If the user doesn't have a Twitter account
    response.status(400);
    response.send("Invalid user");
  }
});

//API 3

const convertApi3 = (dbObject) => {
  return {
    username: dbObject.username,
    tweet: dbObject.tweet,
    dateTime: dbObject.dateTime,
  };
};

app.get("/user/tweets/feed/", Authentication, async (request, response) => {
  const { userId } = request.params;
  const fetchUserLatestTweets = `SELECT user.username AS username, tweet.tweet AS tweet, tweet.date_time AS dateTime
     FROM follower INNER JOIN tweet ON follower.following_user_id=tweet.user_id INNER JOIN user ON  tweet.user_id = user.user_id
 WHERE follower.follower_user_id=${userId}
 ORDER BY tweet.date_time DESC
 LIMIT 4;`;
  const getResultResponse = await db.all(fetchUserLatestTweets);
  response.send(getResultResponse.map((each) => convertApi3(each)));
});

module.exports = app;
