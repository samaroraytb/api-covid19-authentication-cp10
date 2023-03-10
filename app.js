const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// database path define.
const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

// Calling express and App accept json
const app = express();
app.use(express.json());

// Initialization Database and Server
let database = null;

const initializationDatabaseAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("Server is Running at: http://localhost:3000")
    );
  } catch (error) {
    console.log(`Database Error: '${error.message}'`);
    process.exit(1);
  }
};

initializationDatabaseAndServer();

// Authentication FROM Midware Function
const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "My_Secret_Token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// API 1
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const queryToSelectUsername = `
    SELECT *
    FROM user
    WHERE username = '${username}';`;
  const selectUserName = await database.get(queryToSelectUsername);

  if (selectUserName === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      selectUserName.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "My_Secret_Token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API 2
const formattingAllState = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};
app.get("/states/", authentication, async (request, response) => {
  const queryToGetAllState = `
    SELECT *
    FROM state;`;
  const gettingAllState = await database.all(queryToGetAllState);
  response.send(gettingAllState.map((perItem) => formattingAllState(perItem)));
});

// API 3
app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const queryToGetStateAsId = `
  SELECT *
  FROM state
  WHERE state_id = '${stateId}';`;
  const stateAsPerId = await database.get(queryToGetStateAsId);
  response.send(formattingAllState(stateAsPerId));
});

// API 4
app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const queryToUpdateDistricts = `
  INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
  VALUES ('${districtName}','${stateId}', '${cases}','${cured}','${active}','${deaths}');`;
  await database.run(queryToUpdateDistricts);
  response.send("District Successfully Added");
});

// API 5
const formattingDistrict = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const queryToGetDistrictAsId = `
    SELECT *
    FROM district
    WHERE district_id = '${districtId}';`;
    const getDistrictsPerId = await database.get(queryToGetDistrictAsId);
    response.send(formattingDistrict(getDistrictsPerId));
  }
);

// API 6
app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const queryToDeleteDistrict = `
    DELETE FROM district
    WHERE district_id = '${districtId}';`;
    await database.run(queryToDeleteDistrict);
    response.send("District Removed");
  }
);

// API 7
app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const queryToUpdateDistrict = `
  UPDATE district
  SET 
    district_name = '${districtName}',
    state_id = '${stateId}',
    cases = '${cases}',
    cured = '${cured}',
    active = '${active}',
    deaths = '${deaths}'
  WHERE 
    district_id = '${districtId}';`;
    await database.run(queryToUpdateDistrict);
    response.send("District Details Updated");
  }
);

// API 8
app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const queryToGetstats = `
 SELECT sum(cases) AS cases,
    SUM(cured) AS cured,
    SUM(active) AS active,
    SUM(deaths) AS deaths
 FROM district
 WHERE state_id = '${stateId}';`;
    const gettingSum = await database.get(queryToGetstats);
    response.send({
      totalCases: gettingSum.cases,
      totalCured: gettingSum.cured,
      totalActive: gettingSum.active,
      totalDeaths: gettingSum.deaths,
    });
  }
);

module.exports = app;
