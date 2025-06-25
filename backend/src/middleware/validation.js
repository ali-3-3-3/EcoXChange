const { body, param, query, validationResult } = require('express-validator');
const { VALIDATION_RULES } = require('../../../shared/constants');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Common validation rules
const walletAddressValidation = (field = 'walletAddress') => {
  return body(field)
    .isLength({ min: 42, max: 42 })
    .withMessage('Wallet address must be 42 characters')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid Ethereum address format')
    .customSanitizer(value => value.toLowerCase());
};

const emailValidation = (field = 'email', required = false) => {
  const validator = body(field);
  if (!required) {
    validator.optional();
  }
  return validator
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail();
};

const uuidValidation = (field, location = 'param') => {
  const validator = location === 'param' ? param(field) : body(field);
  return validator
    .isUUID()
    .withMessage(`${field} must be a valid UUID`);
};

// User validation rules
const validateUserRegistration = [
  walletAddressValidation('wallet_address'),
  emailValidation('email', false),
  body('name')
    .optional()
    .isLength({ min: VALIDATION_RULES.USER.NAME_MIN_LENGTH, max: VALIDATION_RULES.USER.NAME_MAX_LENGTH })
    .withMessage(`Name must be between ${VALIDATION_RULES.USER.NAME_MIN_LENGTH} and ${VALIDATION_RULES.USER.NAME_MAX_LENGTH} characters`)
    .trim(),
  body('role')
    .optional()
    .isIn(['buyer', 'seller', 'validator', 'admin'])
    .withMessage('Invalid role'),
  handleValidationErrors
];

const validateUserUpdate = [
  emailValidation('email', false),
  body('name')
    .optional()
    .isLength({ min: VALIDATION_RULES.USER.NAME_MIN_LENGTH, max: VALIDATION_RULES.USER.NAME_MAX_LENGTH })
    .withMessage(`Name must be between ${VALIDATION_RULES.USER.NAME_MIN_LENGTH} and ${VALIDATION_RULES.USER.NAME_MAX_LENGTH} characters`)
    .trim(),
  handleValidationErrors
];

// Company validation rules
const validateCompanyRegistration = [
  body('name')
    .isLength({ min: 2, max: 200 })
    .withMessage('Company name must be between 2 and 200 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),
  body('website')
    .optional()
    .isURL()
    .withMessage('Invalid website URL'),
  walletAddressValidation('wallet_address'),
  handleValidationErrors
];

// Project validation rules
const validateProjectCreation = [
  body('title')
    .isLength({ min: VALIDATION_RULES.PROJECT.TITLE_MIN_LENGTH, max: VALIDATION_RULES.PROJECT.TITLE_MAX_LENGTH })
    .withMessage(`Title must be between ${VALIDATION_RULES.PROJECT.TITLE_MIN_LENGTH} and ${VALIDATION_RULES.PROJECT.TITLE_MAX_LENGTH} characters`)
    .trim(),
  body('description')
    .isLength({ min: VALIDATION_RULES.PROJECT.DESCRIPTION_MIN_LENGTH, max: VALIDATION_RULES.PROJECT.DESCRIPTION_MAX_LENGTH })
    .withMessage(`Description must be between ${VALIDATION_RULES.PROJECT.DESCRIPTION_MIN_LENGTH} and ${VALIDATION_RULES.PROJECT.DESCRIPTION_MAX_LENGTH} characters`)
    .trim(),
  body('location')
    .isLength({ min: 2, max: 200 })
    .withMessage('Location must be between 2 and 200 characters')
    .trim(),
  body('project_type')
    .isIn(['reforestation', 'renewable_energy', 'energy_efficiency', 'waste_management', 'carbon_capture', 'other'])
    .withMessage('Invalid project type'),
  body('exc_amount')
    .isFloat({ min: VALIDATION_RULES.PROJECT.MIN_EXC_AMOUNT, max: VALIDATION_RULES.PROJECT.MAX_EXC_AMOUNT })
    .withMessage(`EXC amount must be between ${VALIDATION_RULES.PROJECT.MIN_EXC_AMOUNT} and ${VALIDATION_RULES.PROJECT.MAX_EXC_AMOUNT}`)
    .toFloat(),
  body('carbon_dioxide_saved')
    .isFloat({ min: 1, max: 1000000 })
    .withMessage('Carbon dioxide saved must be between 1 and 1,000,000 tons')
    .toFloat(),
  body('days_till_completion')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days till completion must be between 1 and 365')
    .toInt(),
  handleValidationErrors
];

// Transaction validation rules
const validateBuyTransaction = [
  body('amount')
    .isFloat({ min: VALIDATION_RULES.TRANSACTION.MIN_AMOUNT, max: VALIDATION_RULES.TRANSACTION.MAX_AMOUNT })
    .withMessage(`Amount must be between ${VALIDATION_RULES.TRANSACTION.MIN_AMOUNT} and ${VALIDATION_RULES.TRANSACTION.MAX_AMOUNT}`)
    .toFloat(),
  body('max_price_per_credit')
    .isFloat({ min: VALIDATION_RULES.TRANSACTION.MIN_PRICE, max: VALIDATION_RULES.TRANSACTION.MAX_PRICE })
    .withMessage(`Price must be between ${VALIDATION_RULES.TRANSACTION.MIN_PRICE} and ${VALIDATION_RULES.TRANSACTION.MAX_PRICE}`)
    .toFloat(),
  uuidValidation('project_id', 'body'),
  walletAddressValidation('company_address'),
  handleValidationErrors
];

const validateSellTransaction = [
  body('amount')
    .isFloat({ min: VALIDATION_RULES.TRANSACTION.MIN_AMOUNT, max: VALIDATION_RULES.TRANSACTION.MAX_AMOUNT })
    .withMessage(`Amount must be between ${VALIDATION_RULES.TRANSACTION.MIN_AMOUNT} and ${VALIDATION_RULES.TRANSACTION.MAX_AMOUNT}`)
    .toFloat(),
  body('price_per_credit')
    .isFloat({ min: VALIDATION_RULES.TRANSACTION.MIN_PRICE, max: VALIDATION_RULES.TRANSACTION.MAX_PRICE })
    .withMessage(`Price must be between ${VALIDATION_RULES.TRANSACTION.MIN_PRICE} and ${VALIDATION_RULES.TRANSACTION.MAX_PRICE}`)
    .toFloat(),
  uuidValidation('project_id', 'body'),
  handleValidationErrors
];

// Validator validation rules
const validateValidatorRegistration = [
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .trim(),
  body('credentials')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Credentials must be between 10 and 2000 characters')
    .trim(),
  body('specializations')
    .isArray({ min: 1 })
    .withMessage('At least one specialization is required')
    .custom((value) => {
      const validTypes = ['reforestation', 'renewable_energy', 'energy_efficiency', 'waste_management', 'carbon_capture', 'other'];
      return value.every(spec => validTypes.includes(spec));
    })
    .withMessage('Invalid specialization type'),
  handleValidationErrors
];

const validateProjectValidation = [
  walletAddressValidation('company_address'),
  body('project_id')
    .isInt({ min: 0 })
    .withMessage('Project ID must be a non-negative integer')
    .toInt(),
  body('is_valid')
    .isBoolean()
    .withMessage('is_valid must be a boolean')
    .toBoolean(),
  body('actual_exc')
    .isFloat({ min: 0 })
    .withMessage('Actual EXC must be a non-negative number')
    .toFloat(),
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('sort')
    .optional()
    .isIn(['created_at', 'updated_at', 'name', 'title'])
    .withMessage('Invalid sort field'),
  query('order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Order must be ASC or DESC'),
  handleValidationErrors
];

// File upload validation
const validateFileUpload = [
  body('name')
    .isLength({ min: 1, max: 200 })
    .withMessage('File name must be between 1 and 200 characters')
    .trim(),
  body('type')
    .isIn(['project_plan', 'environmental_impact', 'verification_report', 'financial_statement', 'certification', 'other'])
    .withMessage('Invalid document type'),
  body('is_public')
    .optional()
    .isBoolean()
    .withMessage('is_public must be a boolean')
    .toBoolean(),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  walletAddressValidation,
  emailValidation,
  uuidValidation,
  validateUserRegistration,
  validateUserUpdate,
  validateCompanyRegistration,
  validateProjectCreation,
  validateBuyTransaction,
  validateSellTransaction,
  validateValidatorRegistration,
  validateProjectValidation,
  validatePagination,
  validateFileUpload
};
