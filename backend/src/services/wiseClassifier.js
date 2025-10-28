const pool = require('../config/database');

/**
 * Wise Transaction Classifier
 * Handles automatic classification of Wise transactions into expense categories
 * and employee salary matching with confidence scoring
 */
class WiseClassifier {
  /**
   * Classify a transaction and attempt to match it with employees
   * @param {Object} transaction - Normalized transaction data from Wise
   * @returns {Promise<Object>} Classification result with category, employee match, and confidence
   */
  async classifyTransaction(transaction) {
    const { type, amount, description, merchantName, referenceNumber } = transaction;

    // Initialize result
    const result = {
      category: null,
      employeeId: null,
      confidenceScore: 0,
      needsReview: true,
      reasoning: []
    };

    // For DEBIT (outgoing) transactions, try classification
    if (type === 'DEBIT') {
      // First, try to match with employee salaries (highest priority)
      const employeeMatch = await this.matchEmployee(transaction);

      if (employeeMatch) {
        result.category = 'Employee';
        result.employeeId = employeeMatch.employeeId;
        result.confidenceScore = employeeMatch.confidence;
        result.needsReview = employeeMatch.confidence < 80; // High confidence = no review needed
        result.reasoning = employeeMatch.reasoning;

        return result;
      }

      // If not an employee payment, classify as expense
      const expenseClassification = await this.classifyExpense(transaction);
      result.category = expenseClassification.category;
      result.confidenceScore = expenseClassification.confidence;
      result.needsReview = expenseClassification.confidence < 60; // Medium confidence threshold for expenses
      result.reasoning = expenseClassification.reasoning;

    } else if (type === 'CREDIT') {
      // CREDIT (incoming) transactions default to income
      const incomeClassification = await this.classifyIncome(transaction);
      result.category = incomeClassification.category;
      result.confidenceScore = incomeClassification.confidence;
      result.needsReview = incomeClassification.confidence < 70;
      result.reasoning = incomeClassification.reasoning;
    }

    return result;
  }

  /**
   * Attempt to match a transaction with an employee salary payment
   * @param {Object} transaction - Transaction data
   * @returns {Promise<Object|null>} Employee match result or null
   */
  async matchEmployee(transaction) {
    const { amount, description, merchantName, referenceNumber, transactionDate } = transaction;

    try {
      // Get all active employees
      const employeesResult = await pool.query(
        'SELECT * FROM employees WHERE is_active = true'
      );
      const employees = employeesResult.rows;

      let bestMatch = null;
      let highestConfidence = 0;
      const reasoning = [];

      for (const employee of employees) {
        let confidence = 0;
        const matchReasons = [];

        // Calculate expected payment amount
        const expectedAmount = parseFloat(employee.pay_rate) * parseFloat(employee.pay_multiplier);
        const amountDifference = Math.abs(amount - expectedAmount);
        const amountDifferencePercent = (amountDifference / expectedAmount) * 100;

        // Score based on amount match
        if (amountDifferencePercent === 0) {
          confidence += 50; // Exact match
          matchReasons.push(`Exact amount match: ${amount}`);
        } else if (amountDifferencePercent < 5) {
          confidence += 40; // Within 5%
          matchReasons.push(`Amount close match: ${amount} vs expected ${expectedAmount.toFixed(2)}`);
        } else if (amountDifferencePercent < 10) {
          confidence += 25; // Within 10%
          matchReasons.push(`Amount approximate match: ${amount} vs expected ${expectedAmount.toFixed(2)}`);
        }

        // Score based on name matching in description or reference
        const searchText = `${description || ''} ${merchantName || ''} ${referenceNumber || ''}`.toLowerCase();
        const employeeNameParts = employee.name.toLowerCase().split(' ');

        let nameMatches = 0;
        employeeNameParts.forEach(namePart => {
          if (namePart.length > 2 && searchText.includes(namePart)) {
            nameMatches++;
          }
        });

        if (nameMatches === employeeNameParts.length) {
          confidence += 30; // Full name match
          matchReasons.push(`Full name match in transaction details`);
        } else if (nameMatches > 0) {
          confidence += 15 * nameMatches; // Partial name match
          matchReasons.push(`Partial name match (${nameMatches} parts)`);
        }

        // Score based on payment schedule (weekly/monthly alignment)
        const paymentDate = new Date(transactionDate);
        const dayOfWeek = paymentDate.getDay();
        const dayOfMonth = paymentDate.getDate();

        if (employee.pay_type === 'weekly') {
          // Weekly payments typically on Fridays (5) or last working day
          if (dayOfWeek === 5 || dayOfWeek === 4) {
            confidence += 10;
            matchReasons.push('Payment timing aligns with weekly schedule');
          }
        } else if (employee.pay_type === 'monthly') {
          // Monthly payments typically at end of month or specific day
          const lastDayOfMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 0).getDate();
          if (dayOfMonth >= lastDayOfMonth - 3 || dayOfMonth <= 5) {
            confidence += 10;
            matchReasons.push('Payment timing aligns with monthly schedule');
          }
        }

        // Track best match
        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          bestMatch = {
            employeeId: employee.id,
            employeeName: employee.name,
            confidence,
            reasoning: matchReasons
          };
        }
      }

      // Only return match if confidence is reasonable (>40%)
      if (bestMatch && highestConfidence >= 40) {
        return bestMatch;
      }

      return null;
    } catch (error) {
      console.error('Error matching employee:', error);
      return null;
    }
  }

  /**
   * Classify an expense transaction using keyword rules
   * @param {Object} transaction - Transaction data
   * @returns {Promise<Object>} Classification result
   */
  async classifyExpense(transaction) {
    const { description, merchantName, referenceNumber } = transaction;
    const searchText = `${description || ''} ${merchantName || ''} ${referenceNumber || ''}`.toLowerCase();

    try {
      // Get classification rules from database
      const rulesResult = await pool.query(
        'SELECT * FROM wise_classification_rules WHERE is_active = true ORDER BY priority DESC'
      );
      const rules = rulesResult.rows;

      // Apply rules in priority order
      for (const rule of rules) {
        const regex = new RegExp(rule.keyword_pattern, 'i');
        if (regex.test(searchText)) {
          return {
            category: rule.target_category,
            confidence: 70 + rule.priority / 10, // Higher priority = higher confidence
            reasoning: [`Matched rule: "${rule.rule_name}" based on keywords`]
          };
        }
      }

      // No rule matched - return default category with low confidence
      return {
        category: 'Other Expenses',
        confidence: 30,
        reasoning: ['No matching classification rule found']
      };
    } catch (error) {
      console.error('Error classifying expense:', error);
      console.error('Error details:', error.message, error.stack);
      // Return a safe default instead of Uncategorized with 0%
      return {
        category: 'Other Expenses',
        confidence: 25, // Low but not zero
        needsReview: true,
        reasoning: ['Classification error - needs manual review', `Error: ${error.message}`]
      };
    }
  }

  /**
   * Classify an income transaction
   * @param {Object} transaction - Transaction data
   * @returns {Promise<Object>} Classification result
   */
  async classifyIncome(transaction) {
    const { description, merchantName, referenceNumber, amount } = transaction;
    const searchText = `${description || ''} ${merchantName || ''} ${referenceNumber || ''}`.toLowerCase();

    // Try to match with active contracts
    try {
      const contractsResult = await pool.query(
        'SELECT * FROM contracts WHERE status = $1 AND contract_type IN ($2, $3)',
        ['active', 'monthly', 'yearly']
      );
      const contracts = contractsResult.rows;

      for (const contract of contracts) {
        const contractAmount = parseFloat(contract.amount);
        const amountDifference = Math.abs(amount - contractAmount);
        const amountDifferencePercent = (amountDifference / contractAmount) * 100;

        // Check if amount matches contract
        if (amountDifferencePercent < 5) {
          // Check if client name is mentioned
          const clientName = contract.client_name.toLowerCase();
          if (searchText.includes(clientName) || clientName.includes(searchText.split(' ')[0])) {
            return {
              category: 'Client Payment',
              confidence: 90,
              reasoning: [`Matched contract: ${contract.client_name} (${amount} ≈ ${contractAmount})`],
              contractId: contract.id
            };
          }

          return {
            category: 'Client Payment',
            confidence: 70,
            reasoning: [`Amount matches contract: ${contract.client_name}`],
            contractId: contract.id
          };
        }
      }

      // No contract match - generic income classification
      const keywords = ['invoice', 'payment', 'client', 'project', 'service', 'consulting'];
      const matchedKeywords = keywords.filter(kw => searchText.includes(kw));

      if (matchedKeywords.length > 0) {
        return {
          category: 'Client Payment',
          confidence: 60,
          reasoning: [`Keywords found: ${matchedKeywords.join(', ')}`]
        };
      }

      // Default income category
      return {
        category: 'Other Income',
        confidence: 50,
        reasoning: ['Incoming payment with no specific classification']
      };
    } catch (error) {
      console.error('Error classifying income:', error);
      return {
        category: 'Uncategorized',
        confidence: 0,
        reasoning: ['Error during classification']
      };
    }
  }

  /**
   * Get suggested category for manual review
   * @param {Object} transaction - Transaction data
   * @returns {Promise<Array>} Array of suggested categories with confidence scores
   */
  async getSuggestedCategories(transaction) {
    const allSuggestions = [];

    // Get employee match
    const employeeMatch = await this.matchEmployee(transaction);
    if (employeeMatch && employeeMatch.confidence > 30) {
      allSuggestions.push({
        category: 'Employee',
        employeeId: employeeMatch.employeeId,
        confidence: employeeMatch.confidence,
        reasoning: employeeMatch.reasoning
      });
    }

    // Get expense classification
    const expenseClass = await this.classifyExpense(transaction);
    if (expenseClass.confidence > 30) {
      allSuggestions.push(expenseClass);
    }

    // Sort by confidence
    allSuggestions.sort((a, b) => b.confidence - a.confidence);

    return allSuggestions.slice(0, 3); // Return top 3 suggestions
  }
}

module.exports = new WiseClassifier();
