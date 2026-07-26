package com.solar.micro.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "payments")
@Getter @Setter @NoArgsConstructor
public class Payment {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "invoice_id", length = 36)
    private String invoiceId;

    @Column(name = "customer_id", length = 36)
    private String customerId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(length = 30)
    private String method;

    @Column(name = "payment_date")
    private LocalDate paymentDate;

    @Column(length = 100)
    private String reference;

    @Column(length = 500)
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null || id.isBlank()) id = UUID.randomUUID().toString();
        if (paymentDate == null) paymentDate = LocalDate.now();
        if (method == null) method = "Cash";
    }
}
