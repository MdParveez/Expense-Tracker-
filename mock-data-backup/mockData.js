// Mock data for frontend development
const mockData = {
    // Mock user data
    user: {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        income: 50000,
        phone: "+1234567890"
    },
    
    // Mock expenses data
    expenses: [
        {
            id: 1,
            title: "Grocery Shopping",
            amount: 2500,
            category: "Food",
            date: "2023-06-15",
            note: "Monthly grocery shopping"
        },
        {
            id: 2,
            title: "Movie Night",
            amount: 800,
            category: "Social Life",
            date: "2023-06-18",
            note: "Weekend movie with friends"
        },
        {
            id: 3,
            title: "Gym Membership",
            amount: 1200,
            category: "Health",
            date: "2023-06-01",
            note: "Monthly gym subscription"
        },
        {
            id: 4,
            title: "Electricity Bill",
            amount: 1500,
            category: "HouseHold",
            date: "2023-06-10",
            note: "June electricity bill"
        },
        {
            id: 5,
            title: "Online Course",
            amount: 3000,
            category: "Education",
            date: "2023-06-05",
            note: "Web development course"
        },
        {
            id: 6,
            title: "Bus Pass",
            amount: 1000,
            category: "Transportation",
            date: "2023-06-02",
            note: "Monthly bus pass"
        },
        {
            id: 7,
            title: "New Shoes",
            amount: 2200,
            category: "Apparel",
            date: "2023-06-20",
            note: "Running shoes"
        }
    ],
    
    // Mock bills data
    bills: [
        {
            id: 1,
            name: "Rent",
            amount: 15000,
            date_of_month: 5
        },
        {
            id: 2,
            name: "Internet",
            amount: 1200,
            date_of_month: 10
        },
        {
            id: 3,
            name: "Phone Bill",
            amount: 800,
            date_of_month: 15
        },
        {
            id: 4,
            name: "Netflix",
            amount: 500,
            date_of_month: 20
        },
        {
            id: 5,
            name: "Gym",
            amount: 1500,
            date_of_month: 1
        }
    ],
    
    // Helper functions for mock API
    getNextId: function(collection) {
        return Math.max(...this[collection].map(item => item.id)) + 1;
    },
    
    // Mock API functions
    api: {
        // Expenses API
        getExpenses: function() {
            return Promise.resolve([...mockData.expenses]);
        },
        
        addExpense: function(expense) {
            const newExpense = {
                ...expense,
                id: mockData.getNextId('expenses')
            };
            mockData.expenses.push(newExpense);
            return Promise.resolve(newExpense);
        },
        
        updateExpense: function(id, updatedExpense) {
            const index = mockData.expenses.findIndex(exp => exp.id === id);
            if (index !== -1) {
                mockData.expenses[index] = { ...mockData.expenses[index], ...updatedExpense };
                return Promise.resolve(mockData.expenses[index]);
            }
            return Promise.reject(new Error('Expense not found'));
        },
        
        deleteExpense: function(id) {
            const index = mockData.expenses.findIndex(exp => exp.id === id);
            if (index !== -1) {
                mockData.expenses.splice(index, 1);
                return Promise.resolve({ success: true });
            }
            return Promise.reject(new Error('Expense not found'));
        },
        
        // Bills API
        getBills: function() {
            return Promise.resolve([...mockData.bills]);
        },
        
        addBill: function(bill) {
            const newBill = {
                ...bill,
                id: mockData.getNextId('bills')
            };
            mockData.bills.push(newBill);
            return Promise.resolve(newBill);
        },
        
        updateBill: function(id, updatedBill) {
            const index = mockData.bills.findIndex(bill => bill.id === id);
            if (index !== -1) {
                mockData.bills[index] = { ...mockData.bills[index], ...updatedBill };
                return Promise.resolve(mockData.bills[index]);
            }
            return Promise.reject(new Error('Bill not found'));
        },
        
        deleteBill: function(id) {
            const index = mockData.bills.findIndex(bill => bill.id === id);
            if (index !== -1) {
                mockData.bills.splice(index, 1);
                return Promise.resolve({ success: true });
            }
            return Promise.reject(new Error('Bill not found'));
        },
        
        // User API
        updateIncome: function(income) {
            mockData.user.income = income;
            return Promise.resolve({ ...mockData.user });
        }
    }
};
