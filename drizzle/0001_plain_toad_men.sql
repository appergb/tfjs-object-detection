CREATE TABLE `detectionLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`personId` int,
	`personName` varchar(100),
	`confidence` int,
	`detectedObjects` text,
	`snapshotUrl` varchar(500),
	`userId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `detectionLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `persons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`imageUrl` varchar(500) NOT NULL,
	`faceEmbedding` text,
	`createdBy` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `persons_id` PRIMARY KEY(`id`)
);
