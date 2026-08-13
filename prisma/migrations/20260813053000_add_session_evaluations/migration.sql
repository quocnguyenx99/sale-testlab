CREATE TABLE `session_evaluations` (
    `id` CHAR(36) NOT NULL,
    `session_id` CHAR(36) NOT NULL,
    `evaluator_version` VARCHAR(80) NOT NULL,
    `status` ENUM('COMPLETED', 'FAILED') NOT NULL,
    `overall_score` INTEGER NULL,
    `criteria_json` JSON NULL,
    `strengths_json` JSON NULL,
    `improvement_areas_json` JSON NULL,
    `failure_code` VARCHAR(80) NULL,
    `evaluated_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `session_evaluations_session_id_evaluator_version_key`(`session_id`, `evaluator_version`),
    INDEX `session_evaluations_status_overall_score_idx`(`status`, `overall_score`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `session_evaluations`
    ADD CONSTRAINT `session_evaluations_session_id_fkey`
    FOREIGN KEY (`session_id`) REFERENCES `simulation_sessions`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
