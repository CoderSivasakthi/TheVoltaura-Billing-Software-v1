package com.solar.micro.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "quotations")
@Getter @Setter @NoArgsConstructor
public class Quotation {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "customer_id", length = 36)
    private String customerId;

    @Column(name = "customer_name")
    private String customerName;

    @Column(precision = 12, scale = 2)
    private BigDecimal subtotal;

    @Column(precision = 12, scale = 2)
    private BigDecimal gst;

    @Column(precision = 12, scale = 2)
    private BigDecimal discount;

    @Column(precision = 12, scale = 2)
    private BigDecimal total;

    @Column(length = 20)
    private String status;

    @Column(name = "quote_date")
    private LocalDate quoteDate;

    @Column(name = "valid_until")
    private LocalDate validUntil;

    @Column(length = 1000)
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null || id.isBlank()) {
            id = "Q-" + LocalDate.now().getYear() + "-" + (1000 + (int)(Math.random() * 8999));
        }
        if (status == null) status = "Quoted";
        if (quoteDate == null) quoteDate = LocalDate.now();
        if (validUntil == null) validUntil = LocalDate.now().plusDays(30);
    }
}
