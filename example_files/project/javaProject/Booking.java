package application;

public class Booking {
    private long bookingId;
    private long showId;
    private long guestId;
    private long seatId;
    private String bookingDate;
    private double totalPrice;
    private String status;

    public Booking(long bookingId, long showId, long guestId, long seatId, String bookingDate, double totalPrice) {
        this.bookingId = bookingId;
        this.showId = showId;
        this.guestId = guestId;
        this.seatId = seatId;
        this.bookingDate = bookingDate;
        this.totalPrice = totalPrice;
        this.status = "Confirmed";
    }

    public long getBookingId() {
        return bookingId;
    }

    public void setBookingId(long bookingId) {
        this.bookingId = bookingId;
    }

    public long getShowId() {
        return showId;
    }

    public void setShowId(long showId) {
        this.showId = showId;
    }

    public long getGuestId() {
        return guestId;
    }

    public void setGuestId(long guestId) {
        this.guestId = guestId;
    }

    public long getSeatId() {
        return seatId;
    }

    public void setSeatId(long seatId) {
        this.seatId = seatId;
    }

    public String getBookingDate() {
        return bookingDate;
    }

    public void setBookingDate(String bookingDate) {
        this.bookingDate = bookingDate;
    }

    public double getTotalPrice() {
        return totalPrice;
    }

    public void setTotalPrice(double totalPrice) {
        this.totalPrice = totalPrice;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public void cancelBooking() {
        this.status = "Cancelled";
    }

    public boolean isConfirmed() {
        return "Confirmed".equals(status);
    }

    @Override
    public String toString() {
        return "Booking{" +
                "bookingId=" + bookingId +
                ", showId=" + showId +
                ", guestId=" + guestId +
                ", bookingDate='" + bookingDate + '\'' +
                ", totalPrice=" + totalPrice +
                ", status='" + status + '\'' +
                '}';
    }
}