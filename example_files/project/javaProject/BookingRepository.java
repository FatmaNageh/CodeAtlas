package application;

import java.util.ArrayList;
import java.util.List;

public class BookingRepository {
    private List<Booking> bookings;

    public BookingRepository() {
        this.bookings = new ArrayList<>();
    }

    public void addBooking(Booking booking) {
        bookings.add(booking);
    }

    public void removeBooking(Booking booking) {
        bookings.remove(booking);
    }

    public Booking findBookingById(long id) {
        for (Booking b : bookings) {
            if (b.getBookingId() == id) return b;
        }
        return null;
    }

    public List<Booking> findBookingsByGuestId(long guestId) {
        List<Booking> result = new ArrayList<>();
        for (Booking b : bookings) {
            if (b.getGuestId() == guestId) result.add(b);
        }
        return result;
    }

    public List<Booking> findBookingsByShowId(long showId) {
        List<Booking> result = new ArrayList<>();
        for (Booking b : bookings) {
            if (b.getShowId() == showId) result.add(b);
        }
        return result;
    }

    public List<Booking> getAllBookings() {
        return new ArrayList<>(bookings);
    }

    public int count() {
        return bookings.size();
    }

    public double getTotalRevenue() {
        double total = 0;
        for (Booking b : bookings) {
            if (b.isConfirmed()) total += b.getTotalPrice();
        }
        return total;
    }
}