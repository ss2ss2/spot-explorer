-- CreateTable
CREATE TABLE "users" (
    "userId" INTEGER NOT NULL,
    "username" VARCHAR(255) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "schedules" (
    "scheduleId" UUID NOT NULL,
    "scheduleName" VARCHAR(255) NOT NULL,
    "memo" TEXT NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("scheduleId")
);

-- CreateTable
CREATE TABLE "candidates" (
    "candidateId" SERIAL NOT NULL,
    "candidateName" VARCHAR(255) NOT NULL,
    "url" TEXT,
    "scheduleId" UUID NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("candidateId")
);

-- CreateTable
CREATE TABLE "availabilities" (
    "candidateId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "availability" INTEGER NOT NULL DEFAULT 0,
    "scheduleId" UUID NOT NULL,

    CONSTRAINT "availabilities_pkey" PRIMARY KEY ("candidateId","userId")
);

-- CreateTable
CREATE TABLE "comments" (
    "commentId" SERIAL NOT NULL,
    "scheduleId" UUID NOT NULL,
    "userId" INTEGER NOT NULL,
    "comment" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("commentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "schedules_createdBy_idx" ON "schedules"("createdBy");

-- CreateIndex
CREATE INDEX "candidates_scheduleId_idx" ON "candidates"("scheduleId");

-- CreateIndex
CREATE INDEX "availabilities_scheduleId_idx" ON "availabilities"("scheduleId");

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("scheduleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availabilities" ADD CONSTRAINT "availabilities_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("candidateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availabilities" ADD CONSTRAINT "availabilities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("scheduleId") ON DELETE CASCADE ON UPDATE CASCADE;
