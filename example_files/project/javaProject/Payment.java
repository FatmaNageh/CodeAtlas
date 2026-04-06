package application;

public class Payment {
    private long paymentId;
    private long bookingId;
    private double amount;
    private String paymentMethod;
    private String paymentDate;
    private String status;
    private String transactionId;

    public Payment(long paymentId, long bookingId, double amount, String paymentMethod) {
        this.paymentId = paymentId;
        this.bookingId = bookingId;
        this.amount = amount;
        this.paymentMethod = paymentMethod;
        this.paymentDate = java.time.LocalDate.now().toString();
        this.status = "Pending";
    }

    public long getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(long paymentId) {
        this.paymentId = paymentId;
    }

    public long getBookingId() {
        return bookingId;
    }

    public void setBookingId(long bookingId) {
        this.bookingId = bookingId;
    }

    public double getAmount() {
        return amount;
    }

    public void setAmount(double amount) {
        this.amount = amount;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public String getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(String paymentDate) {
        this.paymentDate = paymentDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getTransactionId() {
        return transactionId;
    }

    public void setTransactionId(String transactionId) {
        this.transactionId = transactionId;
    }

    public boolean processPayment() {
        this.status = "Completed";
        this.transactionId = "TXN-" + System.currentTimeMillis();
        return true;
    }

    public boolean refund() {
        this.status = "Refunded";
        return true;
    }

    @Override
    public String toString() {
        return "Payment{paymentId=" + paymentId + ", amount=" + amount + ", method=" + paymentMethod + ", status=" + status + "}";
    }
}