import app from "./app";
import config from "./config";
import { prisma } from "./lib/prisma";
import { redisClient } from "./lib/redis";
const port = config.port;
const main = async () => {
    try {
        await prisma.$connect();
        console.log("database connect successfully");
        await redisClient.connect();
        console.log("Redis connected Successfully");
        // await seedSuperAdmin();
        // await seedTesterAdmin();
        // await seedTesterFaculty();
        // // await seedTesterStudent();
        app.listen(port, () => {
            console.log(`Server is running successfully on port ${port}`);
        });
    }
    catch (err) {
        console.error("Failed to start the server:", err);
        await prisma.$disconnect();
        process.exit(1);
    }
};
main();
//# sourceMappingURL=server.js.map