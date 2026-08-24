CREATE TABLE `gamification_events` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `event_type` ENUM('SESSION_XP', 'ASSIGNMENT_XP') NOT NULL,
    `credit_status` ENUM('AWARDED', 'REPEAT_CONTENT', 'DAILY_CAP') NOT NULL,
    `rule_version` VARCHAR(80) NOT NULL,
    `points` INTEGER NOT NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `activity_date` DATE NOT NULL,
    `content_key_hash` CHAR(64) NULL,
    `source_session_id` CHAR(36) NULL,
    `source_evaluation_id` CHAR(36) NULL,
    `source_assignment_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `gamification_events_source_evaluation_key`(`source_evaluation_id`),
    UNIQUE INDEX `gamification_events_session_type_key`(`event_type`, `source_session_id`),
    UNIQUE INDEX `gamification_events_assignment_type_key`(`event_type`, `source_assignment_id`),
    INDEX `gamification_events_user_occurred_idx`(`user_id`, `occurred_at`),
    INDEX `gamification_events_occurred_user_idx`(`occurred_at`, `user_id`),
    INDEX `gamification_events_daily_award_idx`(`user_id`, `activity_date`, `event_type`, `credit_status`),
    INDEX `gamification_events_content_day_idx`(`user_id`, `activity_date`, `content_key_hash`),
    INDEX `gamification_events_rule_type_idx`(`rule_version`, `event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `gamification_events`
    ADD CONSTRAINT `gamification_events_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `gamification_events_source_session_id_fkey`
    FOREIGN KEY (`source_session_id`) REFERENCES `simulation_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `gamification_events_source_evaluation_id_fkey`
    FOREIGN KEY (`source_evaluation_id`) REFERENCES `session_evaluations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `gamification_events_source_assignment_id_fkey`
    FOREIGN KEY (`source_assignment_id`) REFERENCES `training_assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
