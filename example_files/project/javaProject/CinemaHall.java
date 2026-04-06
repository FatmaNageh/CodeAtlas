package application;

public class CinemaHall {
    private long hallId;
    private String hallName;
    private int totalSeats;
    private int rows;
    private int seatsPerRow;
    private String screenType;
    private boolean is3DEnabled;

    public CinemaHall(long hallId, String hallName, int rows, int seatsPerRow) {
        this.hallId = hallId;
        this.hallName = hallName;
        this.rows = rows;
        this.seatsPerRow = seatsPerRow;
        this.totalSeats = rows * seatsPerRow;
        this.screenType = "Standard";
        this.is3DEnabled = false;
    }

    public long getHallId() { return hallId; }
    public void setHallId(long hallId) { this.hallId = hallId; }
    public String getHallName() { return hallName; }
    public void setHallName(String hallName) { this.hallName = hallName; }
    public int getTotalSeats() { return totalSeats; }
    public void setTotalSeats(int totalSeats) { this.totalSeats = totalSeats; }
    public int getRows() { return rows; }
    public void setRows(int rows) { this.rows = rows; this.totalSeats = rows * seatsPerRow; }
    public int getSeatsPerRow() { return seatsPerRow; }
    public void setSeatsPerRow(int seatsPerRow) { this.seatsPerRow = seatsPerRow; this.totalSeats = rows * seatsPerRow; }
    public String getScreenType() { return screenType; }
    public void setScreenType(String screenType) { this.screenType = screenType; }
    public boolean is3DEnabled() { return is3DEnabled; }
    public void set3DEnabled(boolean is3DEnabled) { this.is3DEnabled = is3DEnabled; }

    public boolean isFull() { return false; }
    
    @Override
    public String toString() {
        return "CinemaHall{hallId=" + hallId + ", name='" + hallName + "', totalSeats=" + totalSeats + "}";
    }
}