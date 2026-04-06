package application;

import java.util.ArrayList;
import java.util.HashMap;

public class Hall {
	private int seatNumber;
	private static int hallsNumber = 1;
	private int HallId = 1;
	boolean hallIsFull = false;
	public static HashMap<Integer, ArrayList<Seat>> halls = new HashMap<>();

	public Hall() {
		this.HallId = hallsNumber;
		hallsNumber += 1;
	}

	public int getSeatNumber() {
		return seatNumber;
	}

	public void setSeatNumber(int seatNumber) {
		this.seatNumber = seatNumber;
	}

	public int getHallId() {
		return HallId;
	}

	public void setHallId(int hallId) {
		HallId = hallId;
	}
	public String toString() {
		String id = Integer.toString(HallId);
		return  id ;
	}

}
