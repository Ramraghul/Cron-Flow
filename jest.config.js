{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "collectCoverageFrom": ["**/*.(t|j)s"],
  "coverageDirectory": "../coverage",
  "testPathIgnorePatterns": ["/node_modules/", "/dist/"]
}
