<?php

namespace App\Pagination;

use App\Entity\Submission;
use PagerWave\DefinitionGroupTrait;
use PagerWave\DefinitionInterface;
use PagerWave\Extension\Validator\ValidatingDefinitionInterface;

final class SubmissionPage implements DefinitionInterface, ValidatingDefinitionInterface {
    use DefinitionGroupTrait;

    private const SORT_MAP = [
        Submission::SORT_HOT => ['ranking' => true, 'timestamp' => true],
        Submission::SORT_NEW => ['timestamp' => true],
        Submission::SORT_ACTIVE => ['lastActive' => true, 'timestamp' => true],
        Submission::SORT_TOP => ['netScore' => true, 'timestamp' => true],
        Submission::SORT_CONTROVERSIAL => ['netScore' => false, 'timestamp' => false],
        Submission::SORT_MOST_COMMENTED => ['commentCount' => true, 'timestamp' => true],
    ];

    /**
     * @var string
     */
    private $sortBy;

    public function __construct(string $sortBy) {
        if (!isset(self::SORT_MAP[$sortBy])) {
            throw new \InvalidArgumentException("Invalid parameter value ('$sortBy')");
        }

        $this->sortBy = $sortBy;
    }

    public function getFieldNames(): array {
        return array_keys(self::SORT_MAP[$this->sortBy]);
    }

    public function isFieldDescending(string $fieldName): bool {
        return self::SORT_MAP[$this->sortBy][$fieldName];
    }

    public function isFieldValid(string $fieldName, $value): bool {
        switch ($fieldName) {
        case 'ranking':
        case 'id':
        case 'netScore':
        case 'commentCount':
            return is_numeric($value) && \is_int(+$value);
	case 'timestamp':
        case 'lastActive':
            return (bool) @\DateTime::createFromFormat(\DateTime::ATOM, $value);
        default:
            return false;
        }
    }
}
