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

const convertDataBaseObject = (dbObject) => {
  return {
    userId: dbObject.user_id,
    name: dbObject.name,
    username: dbObject.username,
    password: dbObject.password,
  };
};

//Authentication

const Authentication = (request, response, next) => {
  const { tweetId } = request.params;
  const { tweet } = request.body;

  let JWTToken = "";

  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    JWTToken = authHeader.split(" ")[1];
  }
  if (JWTToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jsonwebtoken.verify(JWTToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.tweetId = tweetId;
        request.tweet = tweet;
        request.username = payload;

        next();
      }
    });
  }
};

//API 1 register
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const fetchUserExistenceQuery = `SELECT * FROM user WHERE username='${username}';`;
  const registerDetails = await db.get(fetchUserExistenceQuery);
  if (registerDetails === undefined) {
    if (password.length > 5) {
      const hashingPassword = await bcrypt.hash(password, 10);
      const userRegistration = `INSERT INTO user (username, password, name, gender)
          VALUES ('${username}',
          '${hashingPassword}',
          '${name}',
          '${gender}');`;
      await db.run(userRegistration);

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

//API 2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const fetchUserExistence = `SELECT * FROM user WHERE username='${username}';`;
  const responseUserDetails = await db.get(fetchUserExistence);

  if (responseUserDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const LoginUserDetails = convertDataBaseObject(responseUserDetails);

    const isPasswordMatched = await bcrypt.compare(
      password,
      LoginUserDetails.password
    );
    if (isPasswordMatched === true) {
      const payload = LoginUserDetails.username;

      console.log(payload);
      const jwtToken = jsonwebtoken.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3

app.get("/user/tweets/feed/", Authentication, async (request, response) => {
  const { username } = request;
  const FetchUser_id = `SELECT user_id FROM user WHERE username='${username}';`;
  const user_id = await db.get(FetchUser_id);
  let userId = user_id.user_id;

  const tweetsOfPeopleQuery = `SELECT username,tweet,date_time As dateTime FROM
  user INNER JOIN  follower ON user.user_id = follower.follower_id INNER JOIN  tweet ON following_user_id=tweet.user_id WHERE follower.following_user_id=${userId} ORDER BY tweet.date_time DESC  LIMIT 4;`;

  const responseResult = await db.all(tweetsOfPeopleQuery);
  response.send(responseResult);
});

//API 4
app.get("/user/following/", Authentication, async (request, response) => {
  const { username } = request;
  const FetchUser_id = `SELECT user_id FROM user WHERE username='${username}';`;
  const user_id = await db.get(FetchUser_id);
  let userId = user_id.user_id;

  const tweetsOfPeopleQuery = `SELECT username FROM
  user INNER JOIN  follower ON user.user_id = follower.follower_id  WHERE follower.following_user_id=${userId} ;`;

  const responseResult = await db.all(tweetsOfPeopleQuery);
  response.send(responseResult);
});

//API 5

app.get("/user/followers/", Authentication, async (request, response) => {
  const { username } = request;
  const FetchUser_id = `SELECT user_id FROM user WHERE username='${username}';`;
  const user_id = await db.get(FetchUser_id);
  let userId = user_id.user_id;

  const tweetsOfPeopleQuery = `SELECT username FROM
  user INNER JOIN  follower ON user.user_id = follower.follower_id  WHERE follower.follower_user_id=${userId} ;`;

  const responseResult = await db.all(tweetsOfPeopleQuery);
  response.send(responseResult);
});

//API 6

app.get("/tweets/:tweetId/", Authentication, async (request, response) => {
  const { username } = request;
  const FetchUser_id = `SELECT user_id FROM user WHERE username='${username}';`;
  const user_id = await db.get(FetchUser_id);
  let userId = user_id.user_id;
  const { tweetId } = request;
  const tweetsOfPeopleQuery = `SELECT * FROM
  user INNER JOIN  follower ON user.user_id = follower.follower_id  WHERE follower.following_user_id=${userId} ;`;

  const UserCHeck = await db.all(tweetsOfPeopleQuery);

  const getTweetAsUserRequest = `SELECT * FROM  tweet  WHERE tweet_id=${tweetId};`;
  const responseResult = await db.get(getTweetAsUserRequest);

  if (
    UserCHeck.some((user) => user.following_user_id === responseResult.user_id)
  ) {
    const getTweetQuery = `SELECT tweet,COUNT(DISTINCT (like.like_id)) AS likes , COUNT(DISTINCT (reply.reply_id)) as replies, tweet.date_time AS dateTime
      FROM tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id INNER JOIN reply ON reply.tweet_id=tweet.tweet_id
      WHERE tweet.tweet_id=${tweetId} ;`;

    const tweetResponse = await db.get(getTweetQuery);
    response.send(tweetResponse);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  Authentication,
  async (request, response) => {
    const { username } = request;
    const FetchUser_id = `SELECT user_id FROM user WHERE username='${username}';`;
    const user_id = await db.get(FetchUser_id);
    let userId = user_id.user_id;
    const { tweetId } = request;
    const tweetsOfPeopleQuery = `SELECT * FROM
  user INNER JOIN  follower ON user.user_id = follower.follower_id  WHERE follower.following_user_id=${userId} ;`;

    const UserCHeck = await db.all(tweetsOfPeopleQuery);

    const getTweetAsUserRequest = `SELECT * FROM  tweet  WHERE tweet_id=${tweetId};`;
    const responseResult = await db.get(getTweetAsUserRequest);

    if (
      UserCHeck.some(
        (user) => user.following_user_id === responseResult.user_id
      )
    ) {
      const userTweetLikes = `SELECT DISTINCT(username) from user INNER JOIN tweet ON user.user_id =tweet.user_id INNER JOIN like ON like.tweet_id = tweet.tweet_id WHERE user.user_id=like.user_id;`;
      const responseUserNames = await db.all(userTweetLikes);

      let likes = [];
      for (let user of responseUserNames) {
        likes.push(user.username);
      }
      response.send({ likes });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 8

app.get(
  "/tweets/:tweetId/replies/",
  Authentication,
  async (request, response) => {
    const { username } = request;
    const FetchUser_id = `SELECT user_id FROM user WHERE username='${username}';`;
    const user_id = await db.get(FetchUser_id);
    let userId = user_id.user_id;
    const { tweetId } = request;
    const tweetsOfPeopleQuery = `SELECT * FROM
  user INNER JOIN  follower ON user.user_id = follower.follower_id  WHERE follower.following_user_id=${userId} ;`;

    const UserCHeck = await db.all(tweetsOfPeopleQuery);

    const getTweetAsUserRequest = `SELECT * FROM  tweet  WHERE tweet_id=${tweetId};`;
    const responseResult = await db.get(getTweetAsUserRequest);

    if (
      UserCHeck.some(
        (user) => user.following_user_id === responseResult.user_id
      )
    ) {
      const userTweetReplyLikes = `SELECT name,reply from user INNER JOIN tweet ON user.user_id =tweet.user_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id WHERE user.user_id=reply.user_id;`;
      const responseUserNames = await db.all(userTweetReplyLikes);

      let replies = [];
      for (let user of responseUserNames) {
        replies.push(user);
      }
      response.send({ replies });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get("/user/tweets/", Authentication, async (request, response) => {
  const { username } = request;

  const FetchUser_id = `SELECT user_id FROM user WHERE username='${username}';`;
  const user_id = await db.get(FetchUser_id);
  let userId = user_id.user_id;

  const getTweetDetailsQuery = `SELECT 
  tweet.tweet as tweet ,
  COUNT(DISTINCT(like.like_id)) AS likes,
  COUNT(DISTINCT(reply.reply_id)) AS replies,
  tweet.date_time AS dateTime FROM user INNER JOIN tweet ON user.user_id = tweet.user_id INNER JOIN like ON like.tweet_id =tweet.tweet_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
  WHERE user.user_id=${userId}  
  GROUP BY 
  tweet.tweet_id ;`;
  const tweetsDetails = await db.all(getTweetDetailsQuery);
  response.send(tweetsDetails);
});

app.post("/user/tweets/", Authentication, async (request, response) => {
  const { username } = request;

  const FetchUser_id = `SELECT user_id FROM user WHERE username='${username}';`;
  const user_id = await db.get(FetchUser_id);
  let userId = user_id.user_id;

  const { tweet } = request;
  const { tweetId } = request;
  const postTweetQuery = `INSERT INTO tweet(tweet,user_id)
  VALUES(
      '${tweet}',
      '${userId}'
  ) ;`;
  await db.run(postTweetQuery);
  response.send("Created a Tweet");
});

app.delete("/tweets/:tweetId/", Authentication, async (request, response) => {
  const { tweetId } = request;
  const { tweet } = request;
  const { username } = request;

  const FetchUser_id = `SELECT user_id FROM user WHERE username='${username}';`;
  const user_id = await db.get(FetchUser_id);
  let userId = user_id.user_id;

  const selectUserQuery = `SELECT * FROM tweet WHERE tweet.user_id =${userId} AND tweet.tweet_id =${tweetId};`;
  const tweetUser = await db.all(selectUserQuery);

  if (tweetUser.length !== 0) {
    const deleteTweetQuery = `DELETE FROM tweet WHERE tweet.user_id=${userId} AND tweet.tweet_id=${tweetId};`;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
module.exports = app;
