package com.solar.micro.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "customers")
@Getter @Setter @NoArgsConstructor
public class Customer {

    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false)
    private String name;

    private String email;
    private String phone;
    private String city;
    private String address;
    @Column(name = "shipping_address")
    private String shippingAddress;
    private String gstin;

    @Column(name = "gst_status", length = 20)
    private String gstStatus;

    @Column(precision = 12, scale = 2)
    private BigDecimal balance;

    @Column(length = 20)
    private String status;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null || id.isBlank()) id = UUID.randomUUID().toString();
        if (status == null) status = "Active";
        if (gstStatus == null) gstStatus = "Registered";
        if (balance == null) balance = BigDecimal.ZERO;
    }
}
