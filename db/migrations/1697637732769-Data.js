module.exports = class Data1697637732769 {
    name = 'Data1697637732769'

    async up(db) {
        await db.query(`CREATE TABLE "delegation" ("id" character varying NOT NULL, "delegator" bytea NOT NULL, "space" text NOT NULL, "delegate" bytea NOT NULL, "timestamp" numeric NOT NULL, CONSTRAINT "PK_a2cb6c9b942d68b109131beab44" PRIMARY KEY ("id"))`)
        await db.query(`CREATE TABLE "block_entity" ("id" character varying NOT NULL, "number" numeric NOT NULL, "timestamp" numeric NOT NULL, CONSTRAINT "PK_c3ddd57793960562837e8a402f1" PRIMARY KEY ("id"))`)
        await db.query(`CREATE TABLE "sig" ("id" character varying NOT NULL, "account" bytea NOT NULL, "msg_hash" text NOT NULL, "timestamp" numeric NOT NULL, CONSTRAINT "PK_cea4b8c97c20154f9d4229eef13" PRIMARY KEY ("id"))`)
    }

    async down(db) {
        await db.query(`DROP TABLE "delegation"`)
        await db.query(`DROP TABLE "block_entity"`)
        await db.query(`DROP TABLE "sig"`)
    }
}
